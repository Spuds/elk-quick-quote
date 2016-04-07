<?php

/**
 * @package Quick quote
 * @author Frenzie
 * @license BSD
 */

if (!defined('ELK'))
	die('No access...');

function QQ_integrate_load_theme()
{
	global $txt, $modSettings;

	loadLanguage('quickQuote');
	addInlineJavascript('
		quickQuote.txt = ' . $txt['quick_quote'] . ';', true);

	loadJavascriptFile('quickQuote.js');
}
