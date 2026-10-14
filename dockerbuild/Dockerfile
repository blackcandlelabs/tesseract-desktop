# Docker image to facilitate building Element Desktop's native bits using a glibc version (2.31)
# with broader compatibility, down to Debian bullseye & Ubuntu focal.
FROM rust:bullseye@sha256:fae8ebcb8eda28d37df2b965c87c15a572dac2b6d3893a72d6dea99d700d1786

ENV DEBIAN_FRONTEND=noninteractive

# Non-interactive corepack: the container's pnpm shim otherwise parks
# forever on its first-run download prompt during docker:install.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Tesseract fork: Debian bullseye is EOL and its packages moved to
# archive.debian.org; the stock deb.debian.org sources 404, which breaks
# this image build today. Point apt at the archive and don't enforce
# the archived Release files' (expired) Valid-Until.
RUN sed -i -e 's|deb.debian.org|archive.debian.org|g' -e 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list && \
    echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99-archive

RUN apt-get -qq update && apt-get -y -qq dist-upgrade && \
  apt-get -y -qq install --no-install-recommends \
  # tclsh is required for building SQLite as part of SQLCipher
  tcl \
  # Used by seshat (when not SQLCIPHER_STATIC) \
  libsqlcipher-dev && \
  apt-get purge -y --auto-remove && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/bin/python & ln -s /usr/bin/pip3 /usr/bin/pip

ENV DEBUG_COLORS=true
ENV FORCE_COLOR=true

WORKDIR /project

ARG TARGETOS
ARG TARGETARCH
COPY .node-version dockerbuild/setup.sh /
RUN /setup.sh
