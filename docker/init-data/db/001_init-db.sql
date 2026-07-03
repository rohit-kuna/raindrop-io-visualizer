CREATE USER raindrop WITH ENCRYPTED PASSWORD 'raindrop';
CREATE DATABASE raindrop with owner raindrop;

\connect raindrop;

GRANT ALL PRIVILEGES ON DATABASE raindrop TO raindrop;
