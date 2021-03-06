FROM phusion/passenger-nodejs

RUN apt-get update -qq && apt-get install -qq build-essential python m4 -y

RUN npm config set registry http://registry.npmjs.org/

RUN mkdir /home/app/x
ADD . /home/app/x
RUN cd /home/app/x && npm install --allow-root

WORKDIR /home/app/x