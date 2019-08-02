#!/usr/bin/env bash

function run(){

    pkg_id=$1

    if [[ -z ${pkg_id} ]]; then
        echo "Package file identifier required!"
        exit 1
    fi

    dir=$(pwd);
    export actualDir=$(realpath $dir)
    export prevDir=`cd $actualDir ; cd ..; pwd`

    echo "actualDir: $actualDir"
    echo "prevDir: $prevDir"

    chmod -R 755 $actualDir

    file="${prevDir}/lambda_${pkg_id}.zip"

    package_file="package_${pkg_id}.json"

    cp -r ${actualDir}/${package_file} ${actualDir}/package.json

    rm -rf ${actualDir}/node_modules ${actualDir}/package-lock.json

    `cd ${actualDir} ; npm install --production`

    if [[ -f ${file} ]]; then
        zip  --exclude log/\* -rf ${file} .
    else
        zip  --exclude log/\* -r ${file} .
    fi

    echo "Compression done!"

    aws s3 cp ${file} s3://devops.stagingpepo2.com/

    echo "Upload done!"

}

run $@
