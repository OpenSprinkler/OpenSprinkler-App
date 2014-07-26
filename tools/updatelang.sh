USER="sprinklers"
read -s -p "Password for $USER: " PASS

curl --user $USER:$PASS https://api.getlocalization.com/Sprinklers/api/translations/zip/ -o langs.zip
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
	po2json -p messages.po > "locale/$lang.json"
	rm messages.po
done
