#!/bin/bash

xgettext --keyword=_ --output=- ../js/main.js --omit-header --force-po --language="Python" | sed '/^\#/d' > .msgjs
sed -E 's/data-translate=(".*")/_(\1)/g' ../index.html | xgettext --keyword=_ --output=- --language="Python" --omit-header --force-po - | sed '/^\#/d' > .msghtml
msgcat .msgjs .msghtml > ../locale/messages_en.po
rm .msgjs .msghtml
