#/bin/sh
xgettext --keyword=_ --output=- www/js/analog.js --omit-header --force-po --from-code=UTF-8 --language='javascript'|grep -oP '(?<=msgid) .*'>out.txt

cat out.txt| while read line
do
	echo -n $line
	echo -n ' = '
	T=`~/trans :de -brief $line`
	#printf '%s = %s\n' $line $T
	echo $T,
done