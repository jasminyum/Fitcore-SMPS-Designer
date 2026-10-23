#!/bin/bash

# Directory to search, provided as the first argument
DIR="$1"
NUM=$(echo $DIR | sed 's/circuitjs//' )

# Files to use for input and output
ORIG_FILE="service-worker.orig"
NEW_FILE="service-worker.new"
TEMP_FILE="filelist.$$"

# Ensure the directory is provided
if [[ -z "$DIR" ]]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

# Ensure the original file exists
if [[ ! -f "$ORIG_FILE" ]]; then
  echo "Error: $ORIG_FILE not found."
  exit 1
fi

# Step 1: Generate the list of files and store in the temp file
find "$DIR" -type f -print | sed "s/.*/'&',/" > "$TEMP_FILE"

# Step 2: Replace FILE_LIST_GOES_HERE in service-worker.orig and create service-worker.new
sed "/FILE_LIST_GOES_HERE/{
    r $TEMP_FILE
    d
}" "$ORIG_FILE" | sed "s/cache-v301/cache-d$NUM/" > "$NEW_FILE"

# Step 3: Clean up
rm -f "$TEMP_FILE"

echo "Generated $NEW_FILE successfully."
echo "update the version number and move it into place."

