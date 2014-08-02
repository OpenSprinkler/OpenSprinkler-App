#!/bin/bash

xgettext --keyword=_ --output=- www/js/main.js --omit-header --force-po --language="Python" | sed '/^\#/d' > .msgjs
sed -E 's/data-translate=(".*")/_(\1)/g' www/index.html | xgettext --keyword=_ --output=- --language="Python" --omit-header --force-po - | sed '/^\#/d' > .msghtml
msgcat .msgjs .msghtml > www/locale/messages_en.po
rm .msgjs .msghtml
git add www/locale/messages_en.po
git commit -m "Localization: Update English strings"
git push
