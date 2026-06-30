#!/usr/bin/perl
# One-off repair of js/data.js text fields:
#  1. round-trip demojibake, iterated until stable (some strings are double-encoded):
#     fixes fÃ¼r->für, EspaÃ±ola->Española, Tanzaniaâ€™s->Tanzania's, Ã¢â‚¬â„¢-> ' , …
#     handles both ISO-8859-1 and CP1252 mojibake forms.
#  2. Â¿ -> '  (a mangled right-single-quote/apostrophe seen in titles)
#  3. decode HTML entities that leaked into names (&amp; &#39; &quot;)
#  4. expand truncated funder names (capped ~50 chars on ingest) via a curated,
#     high-confidence map — also merges them with any full duplicate.
# Operates on the raw UTF-8 text so only corrupt bytes change (minimal diff); no
# JSON re-serialisation. Validates the record count is unchanged before writing.
use strict; use warnings;
use utf8;                       # accented string literals below are characters, not bytes
use Encode qw(encode decode FB_CROAK);

# Explicit digraph/triple map for residuals the round-trip can't reach (mixed runs,
# and CP1252 punctuation whose chars sit outside the Latin-1 byte range).
my @DIGRAPH = (
  # CP1252-style smart punctuation (â + Windows-1252 specials)
  "\x{00E2}\x{20AC}\x{2122}" => "'",  "\x{00E2}\x{20AC}\x{02DC}" => "'",
  "\x{00E2}\x{20AC}\x{0153}" => '"',  "\x{00E2}\x{20AC}\x{009D}" => '"',
  "\x{00E2}\x{20AC}\x{201C}" => "-",  "\x{00E2}\x{20AC}\x{201D}" => "-",
  "\x{00E2}\x{20AC}\x{00A6}" => "...","\x{00E2}\x{20AC}\x{00A2}" => "\x{2022}",
  # ISO-8859-1-style smart punctuation (â + C1 control bytes)
  "\x{00E2}\x{0080}\x{0099}" => "'",  "\x{00E2}\x{0080}\x{0098}" => "'",
  "\x{00E2}\x{0080}\x{009C}" => '"',  "\x{00E2}\x{0080}\x{009D}" => '"',
  "\x{00E2}\x{0080}\x{0093}" => "-",  "\x{00E2}\x{0080}\x{0094}" => "-",
  "\x{00E2}\x{0080}\x{00A6}" => "...","\x{00E2}\x{0080}\x{00A2}" => "\x{2022}",
  # accented letters (used when a mixed run blocks the whole-run round-trip)
  "\x{00C3}\x{00A9}"=>"\x{e9}","\x{00C3}\x{00A8}"=>"\x{e8}","\x{00C3}\x{00AA}"=>"\x{ea}",
  "\x{00C3}\x{00BC}"=>"\x{fc}","\x{00C3}\x{00B6}"=>"\x{f6}","\x{00C3}\x{00A4}"=>"\x{e4}",
  "\x{00C3}\x{00B3}"=>"\x{f3}","\x{00C3}\x{00A1}"=>"\x{e1}","\x{00C3}\x{00AD}"=>"\x{ed}",
  "\x{00C3}\x{00B1}"=>"\x{f1}","\x{00C3}\x{00A7}"=>"\x{e7}","\x{00C3}\x{00A0}"=>"\x{e0}",
  "\x{00C3}\x{00A2}"=>"\x{e2}","\x{00C3}\x{00B4}"=>"\x{f4}","\x{00C3}\x{00A3}"=>"\x{e3}",
  "\x{00C3}\x{00BA}"=>"\x{fa}","\x{00C3}\x{00B9}"=>"\x{f9}","\x{00C3}\x{00BB}"=>"\x{fb}",
);
sub demap { my $t=shift; for (my $i=0;$i<@DIGRAPH;$i+=2){ my($a,$b)=@DIGRAPH[$i,$i+1]; $t=~s/\Q$a\E/$b/g; } $t }

# Round-trip a maximal Latin-1 run; fall back to the digraph map if it can't decode.
sub run_rt {
  my $run = shift;
  return $run unless $run =~ /[\x{00C2}\x{00C3}\x{00E2}]/;
  my $b = eval { encode('ISO-8859-1', $run) };
  my $d = defined $b ? eval { decode('UTF-8', $b, FB_CROAK) } : undef;
  return (defined $d && $d ne $run) ? $d : demap($run);
}
sub demoji_pass {
  my $t = shift;
  $t =~ s/\x{00C2}\x{00BF}/'/g;                 # Â¿ -> apostrophe
  $t =~ s{([\x{0080}-\x{00FF}]+)}{ run_rt($1) }ge;
  $t = demap($t);                               # CP1252 triples + residual digraphs
  return $t;
}

my $path = "js/data.js";
open my $fh, "<:encoding(UTF-8)", $path or die "open $path: $!";
local $/; my $s = <$fh>; close $fh;
my $before = () = $s =~ /"id":"/g;

# 1-2. iterate the demojibake until the text stops changing (peels double-encoding)
my ($iters, $prev) = (0, "");
do { $prev = $s; $s = demoji_pass($s); $iters++; } while ($s ne $prev && $iters < 8);

# 3. HTML entities that leaked into names
my $ent = 0;
$ent += ($s =~ s/&amp;/&/g);
$ent += ($s =~ s/&#39;/'/g);
$ent += ($s =~ s/&quot;/\\"/g);   # -> \" so it stays a valid escaped quote in the JSON string

# 4. truncated funder names -> full (exact quoted-value match)
my %trunc = (
  "Federal Ministry for Economic Cooperation and Deve" => "Federal Ministry for Economic Cooperation and Development (BMZ)",
  "Foreign, Commonwealth and Development Office (FCDO"  => "Foreign, Commonwealth and Development Office (FCDO)",
  "International Bank for Reconstruction and Developm"  => "International Bank for Reconstruction and Development",
  "AICS - Italian Agency for Cooperation and Developm"  => "AICS - Italian Agency for Cooperation and Development",
  "United Nations Office for the Coordination of Huma"  => "United Nations Office for the Coordination of Humanitarian Affairs",
  "Directorate-general Development Cooperation and Hu"  => "Directorate-general Development Cooperation and Humanitarian Aid",
  "Ministry of Foreign and European Affairs of the Sl" => "Ministry of Foreign and European Affairs of the Slovak Republic",
  "Centers for Disease Control and Prevention (CDC),"  => "Centers for Disease Control and Prevention (CDC)",
  "Department of Health and Social Care, United Kingd" => "Department of Health and Social Care, United Kingdom",
  "Ministry Of Food And Drug Safety, Republic of Kore" => "Ministry Of Food And Drug Safety, Republic of Korea",
  "Ministry for Europe and Foreign Affairs (MEAE), Fr" => "Ministry for Europe and Foreign Affairs (MEAE), France",
  "AECID Agencia Española de Cooperación Internaciona" => "AECID Agencia Española de Cooperación Internacional para el Desarrollo",
  "French Development Agency (Agence Française de Dev" => "French Development Agency (Agence Française de Développement)",
  "Department of Foreign Affairs, Trade and Developme" => "Department of Foreign Affairs, Trade and Development",
  "Spain - Ministry of Economy, Industry and Competit" => "Spain - Ministry of Economy, Industry and Competitiveness",
  "USAID (United States Agency for International Deve"  => "USAID (United States Agency for International Development)",
  "United Nations High Commissioner for Refugees (UNH" => "United Nations High Commissioner for Refugees (UNHCR)",
  "United Nations Entity for Gender Equality and the"  => "United Nations Entity for Gender Equality and the Empowerment of Women (UN Women)",
  "UK - Department for International Development (DFI"  => "UK - Department for International Development (DFID)",
  "Republic of Korea - International Cooperation Agen" => "Republic of Korea - International Cooperation Agency (KOICA)",
  "Norwegian Agency for Development Cooperation (NORA" => "Norwegian Agency for Development Cooperation (NORAD)",
  "National Institute for Health and Care Research (N" => "National Institute for Health and Care Research (NIHR)",
  "Program for Appropriate Technology In Health (PATH" => "Program for Appropriate Technology In Health (PATH)",
  "Italy - AICS - Agenzia Italiana per la Cooperazion" => "Italy - AICS - Agenzia Italiana per la Cooperazione allo Sviluppo",
  "International Institute for Environment and Develo" => "International Institute for Environment and Development",
  "United Kingdom of Great Britain and Northern Irela" => "United Kingdom of Great Britain and Northern Ireland",
  "Swedish International Development Cooperation Agen" => "Swedish International Development Cooperation Agency (Sida)",
  "Special Fund for Emergency and Rehabilitation Acti" => "Special Fund for Emergency and Rehabilitation Activities (SFERA)",
  "Netherlands-Ministry of Foreign Affairs of the Net" => "Netherlands - Ministry of Foreign Affairs of the Netherlands",
  "Canada - Department of Foreign Affairs, Trade and" => "Canada - Department of Foreign Affairs, Trade and Development",
);
my $tr = 0;
for my $k (keys %trunc) { my $q='"'.$k.'"'; my $r='"'.$trunc{$k}.'"'; $tr += ($s =~ s/\Q$q\E/$r/g); }

my $after = () = $s =~ /"id":"/g;
die "RECORD COUNT CHANGED ($before -> $after) — aborting\n" unless $before == $after;

open my $out, ">:encoding(UTF-8)", $path or die "write $path: $!";
print $out $s; close $out;
print "records: $before (unchanged)\ndemojibake iterations: $iters\n";
print "HTML entities decoded: $ent\ntruncated names expanded: $tr\n";
