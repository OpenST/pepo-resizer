#!/usr/bin/env bash

function run(){

    dir=$(pwd);
    actualDir=$(realpath $dir)
    prevDir=`cd $actualDir ; cd ..; pwd`

    echo "actualDir: $actualDir"
    echo "prevDir: $prevDir"

    chmod -R 755 $actualDir

    file="${prevDir}/lambda.zip"

    if [[ -f ${file} ]]; then
        zip  --exclude log/\* -rf ${file} .
    else
        zip  --exclude log/\* -r ${file} .
    fi

    echo "Compression done!"

    aws s3 cp ${file} s3://devops.stagingpepo2.com/

    echo "Upload done!"

}

run
