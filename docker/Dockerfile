FROM ubuntu:18.04 as BASE

RUN apt-get update
RUN apt-get -y install \
    curl \
    git \
    libffi-dev \
    libfreetype6-dev \
    libjpeg-dev \
    libtiff-dev \
    libwebp-dev \
    libxml2-dev \
    libxslt1-dev \
    libyaml-dev \
    mercurial \
    nodejs \
    npm \
    python3 \
    python3-dev \
    python3-pip \
    zlib1g-dev

RUN pip3 install zc.buildout 'hg+https://bitbucket.org/dholth/cryptacular@cb96fb3#egg=cryptacular'

WORKDIR /opt
RUN git clone https://github.com/mruffalo/fourfront.git

WORKDIR /opt/fourfront
RUN buildout bootstrap
RUN bin/buildout
