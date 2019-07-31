#!/usr/bin/env bash

dir=$(pwd);

echo "dir: $dir"

chmod -R 755 $dir

zip -rf ../lambda.zip . --exclude log
echo "Compression done!"

aws s3 cp ../../releases/lambda.zip s3://devops.stagingpepo2.com/

echo "Upload done!"
