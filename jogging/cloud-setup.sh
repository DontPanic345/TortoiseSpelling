#!/usr/bin/env bash
# Cloud environment setup for Jogging. The environment's setup script runs this file.
# The runner reports only the exit code, so each step exits with its own code.
set -uo pipefail
step() { echo "== $1"; }
die()  { echo "FAILED: $2" >&2; exit "$1"; }

step gradle-mirror
mkdir -p ~/.gradle/init.d && cp "$(dirname "$0")/maven-mirror.gradle" ~/.gradle/init.d/ || die 15 "gradle mirror"

# The environment's setup script doesn't receive the user's variables; the session does.
# Exit 0 there so the session starts, then run this again from the session.
step env
for v in ADB_KEY ADB_KEY_PUB TAILSCALE_AUTHKEY PHONE_ADDR; do
  if [ -z "${!v:-}" ]; then
    echo "SKIPPED: $v is not set here. Run jogging/cloud-setup.sh from the session."
    exit 0
  fi
done

step keys
mkdir -p ~/.android || die 11 mkdir
decode() { case "$1" in -----BEGIN*|QAAAA*) printf '%s\n' "$1" ;; *) printf '%s' "$1" | base64 -d ;; esac; }
decode "$ADB_KEY"     > ~/.android/adbkey     || die 12 "ADB_KEY decode"
decode "$ADB_KEY_PUB" > ~/.android/adbkey.pub || die 13 "ADB_KEY_PUB decode"
chmod 600 ~/.android/adbkey

step packages
(apt-get update -qq && apt-get install -y -qq socat unzip) >/tmp/apt.log 2>&1 || die 20 apt
curl -fsSLo /tmp/pt.zip https://dl.google.com/android/repository/platform-tools-latest-linux.zip || die 21 "platform-tools download"
{ unzip -qo /tmp/pt.zip -d /opt && ln -sf /opt/platform-tools/adb /usr/local/bin/adb; } || die 22 unzip

step tailscale
if ! command -v tailscaled >/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh >/tmp/ts-install.log 2>&1 || die 30 "tailscale install"
fi
# In-memory state registers an ephemeral node, so finished sessions drop off the tailnet.
nohup tailscaled --tun=userspace-networking --state=mem: --socket=/tmp/ts.sock \
  >/tmp/tailscaled.log 2>&1 </dev/null &
for _ in $(seq 20); do [ -S /tmp/ts.sock ] && break; sleep 0.5; done
[ -S /tmp/ts.sock ] || die 31 "tailscaled socket never appeared"
timeout 60 tailscale --socket=/tmp/ts.sock up --authkey="$TAILSCALE_AUTHKEY" --ssh=false --hostname=jogging-cloud \
  || die 32 "tailscale up"

# Userspace networking can't route local sockets into the tailnet, so bridge the phone to localhost.
# Not on 5555-5585: adb scans those local ports for emulators and would list the phone twice.
step bridge
nohup socat TCP-LISTEN:15555,bind=127.0.0.1,fork,reuseaddr \
  EXEC:"tailscale --socket=/tmp/ts.sock nc $PHONE_ADDR 5555" \
  >/tmp/socat.log 2>&1 </dev/null &
adb start-server </dev/null >/dev/null 2>&1 || die 40 "adb start-server"
timeout 30 adb connect 127.0.0.1:15555 || die 41 "adb connect"
adb devices
exit 0
