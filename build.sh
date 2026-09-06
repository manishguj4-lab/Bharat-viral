#!/bin/bash

# Ensure the variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_KEY must be set."
  exit 1
fi

echo "Replacing Supabase credentials in HTML files..."

# Loop through all HTML files
for file in *.html; do
  if [ -f "$file" ]; then
    # Use sed to replace the placeholders
    sed -i "s|__SUPABASE_URL__|$SUPABASE_URL|g" "$file"
    sed -i "s|__SUPABASE_KEY__|$SUPABASE_KEY|g" "$file"
    echo "Processed $file"
  fi
done

echo "Done."
