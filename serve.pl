#!/usr/bin/perl
# Minimal zero-dependency static dev server for Benchmark DB.
# Core Perl only (ships with Git for Windows' Perl) — runs with no Python/Node.
# Uses a non-blocking IO::Select event loop so speculative/idle browser
# connections never stall it.
#
#   perl serve.pl            # http://localhost:8000
#   perl serve.pl 9000       # custom port
use strict;
use warnings;
use IO::Socket::INET;
use IO::Select;
use File::Spec;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

$| = 1;
my $port = $ARGV[0] || 8000;
my $root = dirname(abs_path($0));

my %MIME = (
  html => 'text/html; charset=utf-8',
  css  => 'text/css; charset=utf-8',
  js   => 'application/javascript; charset=utf-8',
  mjs  => 'application/javascript; charset=utf-8',
  json => 'application/json; charset=utf-8',
  map  => 'application/json; charset=utf-8',
  svg  => 'image/svg+xml',
  png  => 'image/png',  jpg => 'image/jpeg', jpeg => 'image/jpeg',
  gif  => 'image/gif',  ico => 'image/x-icon', webp => 'image/webp', avif => 'image/avif',
  woff => 'font/woff',  woff2 => 'font/woff2', ttf => 'font/ttf',
  txt  => 'text/plain; charset=utf-8',
);

my $srv = IO::Socket::INET->new(
  LocalAddr => '0.0.0.0',
  LocalPort => $port,
  Proto     => 'tcp',
  Listen    => 128,
  ReuseAddr => 1,
  Blocking  => 0,
) or die "Cannot listen on port $port: $!\n";

my $sel = IO::Select->new($srv);
my %buf;   # fileno -> accumulated request bytes

print "Benchmark DB (perl) serving $root\n";
print "  -> http://localhost:$port/  (Ctrl+C to stop)\n";

while (1) {
  for my $fh ($sel->can_read(1)) {
    if ($fh == $srv) {
      while (my $c = $srv->accept) {
        $c->blocking(0);
        $sel->add($c);
        $buf{fileno($c)} = '';
      }
      next;
    }
    my $fn = fileno($fh);
    my $n  = sysread($fh, my $chunk, 65536);
    if (!defined $n || $n == 0) { drop($fh); next; }   # EOF / error
    $buf{$fn} .= $chunk;
    # Wait until we have the full request header block.
    next unless $buf{$fn} =~ /\r?\n\r?\n/ || length($buf{$fn}) > 65536;
    handle($fh, $buf{$fn});
    drop($fh);
  }
}

sub drop {
  my $fh = shift;
  delete $buf{fileno($fh)};
  $sel->remove($fh);
  close $fh;
}

sub handle {
  my ($c, $req) = @_;
  my ($line) = split /\r?\n/, $req, 2;
  $line //= '';
  my ($method, $uri) = $line =~ m{^(\S+)\s+(\S+)};
  $uri = '/' unless defined $uri;
  $uri =~ s/\?.*$//;                               # strip query string
  $uri =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;     # percent-decode
  $uri =~ s{\.\.}{}g;                              # naive traversal guard
  $uri = '/index.html' if $uri eq '/' || $uri eq '';

  my @parts = grep { length } split m{/}, $uri;
  my $file  = File::Spec->catfile($root, @parts);

  # Switch to blocking just for the response write (fast over loopback).
  $c->blocking(1);
  if (-f $file && open my $rfh, '<:raw', $file) {
    local $/;
    my $body = <$rfh>;
    close $rfh;
    my ($ext) = lc($file) =~ /\.([^.\\\/]+)$/;
    my $ct = $MIME{$ext // ''} || 'application/octet-stream';
    print $c "HTTP/1.1 200 OK\r\n";
    print $c "Content-Type: $ct\r\n";
    print $c "Content-Length: " . length($body) . "\r\n";
    print $c "Cache-Control: no-store, max-age=0\r\n";
    print $c "Connection: close\r\n\r\n";
    print $c $body;
  } else {
    my $body = "404 Not Found\n$uri\n";
    print $c "HTTP/1.1 404 Not Found\r\n";
    print $c "Content-Type: text/plain; charset=utf-8\r\n";
    print $c "Content-Length: " . length($body) . "\r\n";
    print $c "Connection: close\r\n\r\n";
    print $c $body;
  }
}
