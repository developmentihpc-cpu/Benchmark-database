#!/usr/bin/perl
# Pull OLDER IATI activities to extend each in-data sector's sample back 5 years
# (default window 2016-01-01 .. 2021-06-01, i.e. the gap before the existing
# RECENT_SINCE of 2021-06-02). A Perl port of datastore_pull.py that ADDS the
# publisher-capped round-robin draw required for representativeness: at most
# --cap activities per publisher per sector, counting the records already in the
# data, so no single donor can dominate a sector's median. Nothing is fabricated
# — an activity missing a recipient country, a developing-country match or a
# title is skipped.
#
#   IATI_DATASTORE_KEY=... perl datastore_pull.pl [opts]
#     --target N     desired total programmes per sector      (default 120)
#     --cap C        max activities per publisher per sector   (default 6)
#     --since D      window start (YYYY-MM-DD)                 (default 2016-01-01)
#     --until D      window end                                (default 2021-06-01)
#     --per-query R  rows fetched per sector query             (default 600)
#     --codes a,b    only these DAC codes (default: every sector already in data)
#     --dry-run      parse + report only; no network, no write
#
# Never commit the key. Use an environment variable only.
use strict; use warnings; use utf8;
use HTTP::Tiny; use JSON::PP;

# ---------------- args ----------------
my %opt = (target=>120, cap=>6, since=>"2016-01-01", until=>"2021-06-01",
           "per-query"=>600, codes=>"", "dry-run"=>0);
while (@ARGV) { my $a = shift @ARGV;
  if ($a eq "--dry-run") { $opt{"dry-run"} = 1; }
  elsif ($a =~ /^--(target|cap|since|until|per-query|codes)$/) { $opt{$1} = shift @ARGV; }
  else { die "unknown arg: $a\n"; }
}
my $KEY = $ENV{IATI_DATASTORE_KEY};
die "Set IATI_DATASTORE_KEY (free key from https://developer.iatistandard.org/).\n"
  unless $KEY || $opt{"dry-run"};

# ---------------- reference maps (from iati_ingest.py) ----------------
my %ORG_TYPE = (
  "10"=>["Bilateral","Government"], "11"=>["Bilateral","Local Government"],
  "15"=>["Bilateral","Other public sector"],
  "21"=>["NGO","International NGO"], "22"=>["NGO","National NGO"],
  "23"=>["NGO","Regional NGO"], "24"=>["NGO","Partner-country NGO"],
  "30"=>["Private sector","Public-private partnership"],
  "40"=>["Multilateral","Multilateral"], "60"=>["Foundation","Foundation"],
  "70"=>["Private sector","Private sector"], "71"=>["Private sector","Private sector (provider)"],
  "72"=>["Private sector","Private sector (recipient)"], "73"=>["Private sector","Private sector (third-country)"],
  "80"=>["NGO","Academic / research"], "90"=>["NGO","Other"],
);
my %STATUS = ("1"=>"Planned","2"=>"Ongoing","3"=>"Finalisation","4"=>"Closed","5"=>"Cancelled","6"=>"Suspended");

sub stream_for {
  my $sc = shift // ""; my ($g3,$g2) = (substr($sc,0,3), substr($sc,0,2));
  return "WASH" if $g3 eq "140";
  return "Humanitarian" if $g3 eq "720" || $g3 eq "730" || $g3 eq "740";
  return "Governance/Capacity" if $g3 eq "151" || $g3 eq "152";
  return "Infrastructure & Economic" if grep { $_ eq $g2 } qw(21 22 23 24 25 32 33 41);
  return "Development";
}
sub english_clean {
  my ($t) = @_; return undef unless defined $t && length $t;
  $t =~ s/<[^>]+>/ /g; $t =~ s/\s+/ /g; $t =~ s/^\s+|\s+$//g;
  return undef unless length $t;
  return undef if $t =~ /no description.{0,40}available|description indisponible|description non disponible|sin descripci|pas de description/i;
  my %en = map {$_=>1} qw(the of and to will this that with from are is by has have been it its their our we project programme support improve provide training health water education women children communities community access rural development assistance services people national local government district market farmers schools);
  my %fr = map {$_=>1} qw(le la les des une un et pour dans avec sur par au aux que qui cette leur sont nous vous ses développement renforcement gestion appui projet santé éducation communauté mise oeuvre accès formation afin proyecto programa apoyo);
  my $low = lc $t; my ($ec,$fc) = (0,0);
  for my $w ($low =~ /([a-zà-ÿ']+)/g) { $ec++ if $en{$w}; $fc++ if $fr{$w}; }
  return undef if ($fc >= 3 && $fc > $ec);
  my $CAP = 2000; return $t if length($t) <= $CAP;
  my $c = substr($t,0,$CAP);
  return "$1…" if $c =~ /^(.{400,}[.!?])\s/s;
  return "$1…" if $c =~ /^(.*)\s\S+$/s;
  return "$c…";
}
sub first { my $v = shift; return undef unless defined $v; return (ref $v eq "ARRAY") ? (@$v ? $v->[0] : undef) : $v; }
sub num   { my $v = first(shift); return undef unless defined $v; return ($v =~ /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/) ? $v+0 : undef; }
sub uesc  { my $s = shift; $s =~ s/([^A-Za-z0-9_.~-])/sprintf("%%%02X",ord($1))/ge; return $s; }

# ---------------- load data.js context ----------------
my $J = JSON::PP->new->utf8;
my $DATA = "js/data.js";
open my $fh, "<:raw", $DATA or die "open $DATA: $!";
local $/; my $src = <$fh>; close $fh;
$src =~ /const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=/ or die "cannot locate PROGRAMS";
my $PROG_BODY = $1;
my $progs = $J->decode($PROG_BODY);
$src =~ /const DEVREGION=(\{[\s\S]*?\});/ or die "cannot locate DEVREGION";
my $devr = $J->decode($1);
my %region = map { lc($_) => $devr->{$_} } keys %$devr;
my (%cc2name, %sn_map, %seen, %seccount, %orgcount);
for my $p (@$progs) {
  $cc2name{$p->{cc}} = $p->{co} if $p->{cc} && defined $p->{co};
  $sn_map{$p->{sc}}  = $p->{sn} if $p->{sc} && defined $p->{sn};
  $seen{$p->{id}} = 1 if defined $p->{id};
  if (defined $p->{sc} && $p->{sc} ne "") {
    $seccount{$p->{sc}}++;
    $orgcount{$p->{sc}}{$p->{r}}++ if defined $p->{r};
  }
}
my @codes = $opt{codes} ne "" ? (grep { length } split /,/, $opt{codes}) : (sort keys %seccount);
printf "%d programmes, %d sectors loaded. Window %s..%s; target %d/sector, cap %d/publisher.\n",
  scalar(@$progs), scalar(keys %seccount), $opt{since}, $opt{until}, $opt{target}, $opt{cap};

# ---------------- classify one Solr doc ----------------
sub build {
  my ($doc, $code) = @_;
  my $aid = first($doc->{iati_identifier}); return undef unless defined $aid && length $aid;
  my $cc  = uc(first($doc->{recipient_country_code}) // ""); return undef unless $cc;
  my $co  = $cc2name{$cc}; return undef unless defined $co;        # developing-country scope
  my $rg  = $region{lc $co}; return undef unless defined $rg;
  my $title = first($doc->{title_narrative}); return undef unless defined $title && length $title;
  my $desc  = english_clean(first($doc->{description_narrative}));
  my $org   = first($doc->{reporting_org_narrative}); $org = "—" unless defined $org && length $org;
  my $otc   = first($doc->{reporting_org_type_code}); $otc = defined $otc ? "$otc" : "";
  my ($d,$rt) = @{ $ORG_TYPE{$otc} // ["Multilateral","Other"] };
  my $cur = uc(first($doc->{default_currency}) // first($doc->{budget_value_currency}) // "USD");
  my $amt = 0; my $bv = $doc->{budget_value};
  if (ref $bv eq "ARRAY") { for (@$bv) { my $n = num($_); $amt += $n if defined $n; } }
  else { my $n = num($bv); $amt = $n if defined $n; }
  my $isos  = $doc->{activity_date_iso_date};  $isos  = ref $isos  eq "ARRAY" ? $isos  : [defined $isos  ? $isos  : ()];
  my $types = $doc->{activity_date_type};      $types = ref $types eq "ARRAY" ? $types : [defined $types ? $types : ()];
  my ($st,$en);
  for my $i (0 .. $#$isos) {
    my $ty = "" . ($types->[$i] // ""); my $iso = substr(($isos->[$i] // ""), 0, 10);
    next unless $iso;
    $st = $iso if ($ty eq "1" || $ty eq "2");
    $en = $iso if ($ty eq "3" || $ty eq "4");
  }
  my $sta  = $STATUS{ "" . (first($doc->{activity_status_code}) // "") } // "Ongoing";
  my $year = ($st && substr($st,0,4) =~ /^\d{4}$/) ? int(substr($st,0,4)) : undef;
  my %rec = (
    n=>$title, d=>$d, r=>$org, rt=>$rt, s=>stream_for($code), sc=>$code,
    sn=>($sn_map{$code} // "DAC $code"), co=>$co, cc=>$cc, rg=>$rg,
    sta=>$sta, multi=>0, st=>($st||undef), en=>($en||undef), c=>$cur,
    a=>(0 + sprintf("%.2f", $amt||0)), b=>"budget", rc=>undef, rb=>"", re=>0,
    year=>$year, fn=>$org, pcc=>"", pn=>"", id=>$aid,
  );
  $rec{desc} = $desc if defined $desc;
  return \%rec;
}

# ---------------- query the official datastore ----------------
my $ENDPOINT = "https://api.iatistandard.org/datastore/activity/select";
my $FL = join(",", qw(iati_identifier title_narrative description_narrative
  reporting_org_ref reporting_org_type_code reporting_org_narrative
  recipient_country_code sector_code sector_vocabulary activity_status_code
  default_currency activity_date_iso_date activity_date_type budget_value budget_value_currency));
my $FQ = "(activity_date_start_actual:[$opt{since}T00:00:00Z TO $opt{until}T23:59:59Z]"
       . " OR activity_date_start_planned:[$opt{since}T00:00:00Z TO $opt{until}T23:59:59Z])";
my $http = HTTP::Tiny->new(timeout=>90, verify_SSL=>0, agent=>"BenchmarkDB-pull/1.0 (perl)");
sub query {
  my ($code) = @_;
  my %p = (q=>"sector_code:$code AND sector_vocabulary:1", fq=>$FQ, fl=>$FL,
           rows=>$opt{"per-query"}, start=>0, wt=>"json");
  my $url = $ENDPOINT . "?" . join("&", map { uesc($_)."=".uesc($p{$_}) } sort keys %p);
  for my $att (0..2) {
    my $r = $http->get($url, { headers => {
      "Ocp-Apim-Subscription-Key"=>$KEY, "Accept"=>"application/json" } });
    if ($r->{success}) {
      my $j = eval { $J->decode($r->{content}) };
      return ($j->{response}{docs} // []) if $j;
    }
    sleep(1 + $att);
  }
  warn "  ! $code: query failed (" . ($opt{"dry-run"} ? "dry-run" : "network") . ")\n";
  return [];
}

# ---------------- pull per sector, publisher-capped ----------------
my @added;
for my $code (@codes) {
  my $have = $seccount{$code} // 0;
  next if $have >= $opt{target};
  my $docs = $opt{"dry-run"} ? [] : query($code);
  my @cands;
  for my $doc (@$docs) {
    my $rec = build($doc, $code) or next;
    next if $seen{$rec->{id}};
    push @cands, $rec;
  }
  # round-robin across publishers, <= cap total (existing + new) per publisher
  my %byorg; push @{$byorg{$_->{r}}}, $_ for @cands;
  my @orgs = sort keys %byorg;
  my (%newper, @kept); my $need = $opt{target} - $have; my $progress = 1;
  while (@kept < $need && $progress) {
    $progress = 0;
    for my $org (@orgs) {
      last if @kept >= $need;
      my $existing = $orgcount{$code}{$org} // 0;
      next if ($existing + ($newper{$org} // 0)) >= $opt{cap};
      my $list = $byorg{$org}; next unless @$list;
      my $rec = shift @$list; next if $seen{$rec->{id}};
      push @kept, $rec; $newper{$org}++; $seen{$rec->{id}} = 1; $progress = 1;
    }
  }
  $seccount{$code} += scalar @kept;
  push @added, @kept;
  printf "  %-6s %-34s had %3d  +%-3d  (%d candidates, %d publishers)\n",
    $code, substr($sn_map{$code} // "", 0, 34), $have, scalar(@kept), scalar(@cands), scalar(@orgs)
    if @$docs || !$opt{"dry-run"};
}

printf "\nReady to add %d programmes across %d sectors.\n", scalar(@added),
  scalar(keys %{{ map { $_->{sc}=>1 } @added }});
if ($opt{"dry-run"}) { print "[dry-run] nothing written.\n"; exit 0; }
exit 0 unless @added;

# ---------------- splice into data.js ----------------
my $addition = join("", map { "," . $J->encode($_) } @added);
my $newbody  = substr($PROG_BODY, 0, -1) . $addition . "]";   # insert before closing ]
my $at = index($src, $PROG_BODY);
substr($src, $at, length($PROG_BODY)) = $newbody;
$src =~ s/("nprog":\s*)(\d+)/$1 . ($2 + scalar @added)/e;

# sanity: new record count must equal old + added
my $after = () = $src =~ /"id":"/g;
my $before = scalar @$progs;
die "record-count sanity failed ($before + ".scalar(@added)." != $after)\n"
  unless $after == $before + scalar(@added);

open my $out, ">:raw", $DATA or die "write $DATA: $!";
print $out $src; close $out;
printf "Wrote %d new programmes into %s (now %d). Next: datastore_totals.py for universe counts, then enrich_llm.py.\n",
  scalar(@added), $DATA, $after;
