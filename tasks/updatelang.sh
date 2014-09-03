curl --user $1:$2 https://api.getlocalization.com/Sprinklers/api/translations/zip/ -o langs.zip
unzip langs.zip
rm langs.zip
find . -type f -maxdepth 1 -iname "messages_*.po" -print0 | while IFS= read -r -d $'\0' line; do
	file=(${line//_/ })
	lang=${file[1]}
	file=(${lang//-/ })
	lang=${file[0]}
	file=(${lang//./ })
	lang=${file[0]}

	mv "$line" messages.po
	po2json -p messages.po > "www/locale/$lang.js"
	rm messages.po
done
git add www/locale/*
git commit -m "Localization: Update languages from getlocalization.com"
git push
