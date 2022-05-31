/*!
 * @package   Quick Quote
 * @copyright Frenzie : Frans de Jonge
 * @license   BSD http://opensource.org/licenses/BSD-3-Clause (see accompanying LICENSE.txt file)
 *
 * @version 2.0 dev
 */

/**
 * This particular function was based on My Opera Enhancements and is
 * licensed under the BSD license.
 */
function initializeQuickQuote()
{
	'use strict';

	treeToBBCode.defaults = {
		strong: {before: '[b]', after: '[/b]'},
		b: {before: '[b]', after: '[/b]'},
		i: {before: '[i]', after: '[/i]'},
		em: {before: '[i]', after: '[/i]'},
		s: {before: '[s]', after: '[/s]'},
		sup: {before: '[sup]', after: '[/sup]'},
		sub: {before: '[sub]', after: '[/sub]'},
		pre: {before: '[code]', after: '[/code]'},
		br: {before: '\n', after: ''}
	};

	/**
	 * Transverses tree under node and set a flag telling whether element is hidden or not
	 *
	 * @param {object} node
	 */
	function setHiddenFlag(node)
	{
		if (!node)
		{
			return;
		}

		if (typeof node.item === 'function')
		{
			node.forEach((asNode) =>
			{
				setHiddenFlag(asNode);
			});
		}
		else if (isHidden(node) !== '')
		{
			node.setAttribute('userjsishidden', 'true');
		}
		else
		{
			if (node.removeAttribute)
			{
				node.removeAttribute('userjsishidden');
			}

			if (node.childNodes)
			{
				setHiddenFlag(node.childNodes);
			}
		}
	}

	/**
	 * Tells if element should be considered as not visible
	 *
	 * @param {Node} node
	 * @returns {string}
	 */
	function isHidden(node)
	{
		if (node && node.nodeType === Node.ELEMENT_NODE)
		{
			let compStyles = getComputedStyle(node, '');

			if (node.nodeName.toLowerCase() === 'br') return '';
			if (compStyles.display === 'none') return 'display:none';
			if (compStyles.visibility === 'hidden') return 'visibility:hidden';
			if (parseFloat(compStyles.opacity) < 0.1) return 'opacity';
			if (node.offsetHeight < 4) return 'offsetHeight';
			if (node.offsetWidth < 4) return 'offsetWidth';

			return '';
		}

		return '';
	}

	/**
	 * Compares CSS properties against a predefined array
	 *
	 * @param {object} node
	 * @param {array} props
	 * @returns {{start: string, end: string}}
	 */
	function checkCSSProps(node, props)
	{
		let start = '',
			end = '',
			value;

		props.forEach((prop) =>
		{
			// Check for class name
			if (typeof prop.isClass !== 'undefined')
			{
				value = node.classList.contains(prop.name) ? prop.name : '';
			}
			// Or style attribute
			else
			{
				value = trim(node.style[prop.name] || '', ' "');
			}

			if ((prop.forceValue && value === prop.forceValue) || (!prop.forceValue && value))
			{
				start += prop.before.replace('@value', (prop.values ? prop.values[value] : null) || value);
				end += prop.after;
			}
		});

		return {start: start, end: end};
	}

	/**
	 * Parses the tree into bbcode
	 *
	 * @param {object} node
	 * @returns {string}
	 */
	function treeToBBCode(node)
	{
		let checked,
			start,
			end,
			bb = [],
			props = [];

		if (typeof node.item === 'function')
		{
			node.forEach((asNode) => {
				bb.push(treeToBBCode(asNode));
			});

			return bb.join('');
		}

		if (node.getAttribute && node.getAttribute('userjsishidden') === 'true')
		{
			return '';
		}

		switch (node.nodeType)
		{
			// nodeType 1, like div, p, ul
			case Node.ELEMENT_NODE:
				let nodeName = node.nodeName.toLowerCase(),
					def = treeToBBCode.defaults[nodeName];

				// Generic wrap behavior for basic BBC tags like [b], [i], [u]
				if (def)
				{
					bb.push(def.before || '');
					bb.push(treeToBBCode(node.childNodes));
					bb.push(def.after || '');
				}
				// Special Processing cases
				else
				{
					switch (nodeName)
					{
						case 'a':
							if (node.href.indexOf('mailto:') === 0)
							{
								bb.push('[email=' + node.href.substring(7) + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/email]');
							}
							else if (node.className.indexOf("attach") >= 0)
							{
								bb.push('[attach=' + node.href + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/attach]');
							}
							else
							{
								bb.push('[url=' + node.href + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/url]');
							}
							break;
						case 'div':
							props = [
								{name: 'textAlign', forceValue: 'left', before: '[left]', after: '[/left]'},
								{name: 'textAlign', forceValue: 'right', before: '[right]', after: '[/right]'},
								{name: 'centertext', before: '[center]', after: '[/center]', isClass: true},
							];
							checked = checkCSSProps(node, props);

							bb.push(checked.start);
							bb.push(treeToBBCode(node.childNodes));
							bb.push(checked.end);
							break;
						case 'img':
							let smileyCode = getSmileyCode(node);

							bb.push(smileyCode ? ' ' + smileyCode + ' ' : '[img]' + node.src + '[/img]');
							break;
						case 'ul':
							props = [
								{name: 'listStyleType', forceValue: 'decimal', before: '[list type=decimal]', after: '[/list]'},
							];
							checked = checkCSSProps(node, props);

							bb.push((checked.start !== '') ? checked.start : '[list]');

							let lis = node.querySelectorAll('li');

							lis.forEach((li) =>
							{
								bb.push('\n  [*] ' + trim(treeToBBCode(li)));
							});

							bb.push('[/list]');
							break;
						case 'span':
							// Check for css properties
							props = [
								{name: 'textDecoration', forceValue: 'underline', before: '[u]', after: '[/u]'},
								{name: 'color', before: '[color=@value]', after: '[/color]'},
								{name: 'fontFamily', before: '[font=@value]', after: '[/font]'},
								{name: 'bbc_tt', before: '[tt]', after: '[/tt]', isClass: true},
								{name: 'fontSize', before: '[size=@value]', after: '[/size]', values: {
										'xx-small': 1,
										'x-small': 2,
										'small': 3,
										'medium': 4,
										'large': 5,
										'x-large': 6,
										'xx-large': 7
									}
								}
							];
							checked = checkCSSProps(node, props);
							start = checked.start;
							end = checked.end;

							bb.push(start);
							bb.push(treeToBBCode(node.childNodes));
							bb.push(end);
							break;
						case 'p':
							bb.push(treeToBBCode(node.childNodes));
							break;
						case 'cite':
							let nc = node.firstChild,
								ns = node.nextSibling;

							// Add the author, date, message information to the blockquote props
							if (nc &&
								ns &&
								nc.nodeName.toLowerCase() === 'a' &&
								ns.nodeName.toLowerCase() === 'blockquote')
							{
								ns.__userNameQuoted = node.textContent.split(':')[1].split(String.fromCharCode(160))[0].trim();
								ns.__link = new URL(nc.getAttribute('href')).search.substring(1);

								let when = nc.querySelector('time');
								if (when !== null)
								{
									ns.__timedate = when.getAttribute('data-timestamp');
								}
							}
							break;
						case 'blockquote':
							if (node.classList.contains("bbc_quote"))
							{
								bb.push('[quote' +
									(node.__userNameQuoted ? ' author=' + node.__userNameQuoted : '') +
									(node.__link ? ' link=' + node.__link : '') +
									(node.__timedate ? ' date=' + node.__timedate : '') + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/quote]' + "\n");
							}
							else
							{
								bb.push(treeToBBCode(node.childNodes));
							}
							break;
						default:
							bb.push(treeToBBCode(node.childNodes));
							break;
					}
				}
				break;
			case Node.DOCUMENT_NODE:// 9
			case Node.DOCUMENT_FRAGMENT_NODE:// 11
				bb.push(treeToBBCode(node.childNodes));
				break;
			case Node.TEXT_NODE:// 3
			case Node.CDATA_SECTION_NODE:// 4
				let text = node.nodeValue,
					codecheck = document.evaluate('ancestor::pre', node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

				if (!codecheck)
				{
					text = text.replace(/\n[ \t]+/g, '\n');
				}
				bb.push(text);
				break;
		}

		return bb.join('');
	}

	/**
	 * Trim string by whitespace or specific characters
	 *
	 * @param {string} str
	 * @param {string|null} charToReplace
	 * @returns {string}
	 */
	function trim(str, charToReplace = null)
	{
		// if char is specified, use that one else clear whitespace
		if (charToReplace)
		{
			return String(str).replace(new RegExp('^[' + charToReplace + ']+|[' + charToReplace + ']+$', 'g'), '');
		}

		return str.trim();
	}

	/**
	 * Returns smiley code
	 *
	 * @param {Object} img
	 * @returns {string}
	 */
	function getSmileyCode(img)
	{
		if (img.alt && img.className && img.classList.contains('smiley'))
		{
			// Alternative text corresponds to smiley and emoji code
			return img.alt;
		}

		// Event not spawned by a forum smiley (else match smiley name below)
		return '';

		/*
		var smileyName = RegExp.$1;

		if (buildSmileyTooltip.buildSmileyTooltipMatches[smileyName]) // Smiley is in exception list.
			return buildSmileyTooltip.buildSmileyTooltipMatches[smileyName];
		else // Use filename to obtain smiley code.
			return ':'+smileyName+':';
		*/
	}

	/**
	 * Called when the quick quote button is pressed, passed a PointerEvent
	 *
	 * @param {PointerEvent} e
	 */
	function executeQuickQuote(e)
	{
		e.preventDefault();

		let startTag = e.target.startTag,
			endTag = e.target.endTag;

		// isCollapsed is true for an empty selection
		let selection = (window.getSelection().isCollapsed ? null : window.getSelection().getRangeAt(0));
		if (selection)
		{
			let selectionAncestor = selection.commonAncestorContainer,
				selectionContents,
				quoteHeader,
				postAncestor = document.evaluate('ancestor-or-self::section[contains(@class,"messageContent")]', selectionAncestor, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

			setHiddenFlag(selectionAncestor);

			if (selectionAncestor.nodeType !== 3)
			{
				// Most likely an element node
				selectionContents = selectionAncestor.cloneNode(false);
				selectionContents.appendChild(selection.cloneContents());
			}
			else
			{
				// Plain text
				selectionContents = selection.cloneContents();
			}

			if (postAncestor)
			{
				// Clone tree upwards. Some BBCode requires more context
				// than just the current node, like lists.
				let newSelectionContents;
				while (selectionAncestor !== postAncestor)
				{
					selectionAncestor = selectionAncestor.parentNode;

					// In ElkArte blockquote and cite are parent/child, however we shift this
					// such that they are siblings in the clone, makes parsing easier
					if (selectionAncestor.nodeName.toLowerCase() === 'blockquote' &&
						selectionAncestor.classList.contains('bbc_quote'))
					{
						// Go deep so we get all the details
						quoteHeader = selectionAncestor.firstChild.cloneNode(true);
					}

					newSelectionContents = selectionAncestor.cloneNode(false);

					newSelectionContents.appendChild(selectionContents);

					selectionContents = newSelectionContents;
				}
			}

			// If there was a blockquote cite, insert it before the blockquote in this fragment, yielding
			// <section><cite><a></a></cite><blockquote></blockquote></section> This allows
			// us to parse cite information before we process the actual blockquote
			if (quoteHeader)
			{
				selectionContents.insertBefore(quoteHeader, selectionContents.firstChild);
			}

			let selectedText = trim(treeToBBCode(selectionContents));

			if (typeof oQuickReply === 'undefined' || oQuickReply.bIsFull)
			{
				// Full editor in quick reply
				$editor_data[post_box_name].insert(startTag + selectedText + endTag);
			}
			else
			{
				// Just the textarea
				let textarea = document.querySelector('#postmodify').message,
					newText = (textarea.value ? textarea.value + '\n' : '') + startTag + selectedText + endTag + '\n';

				textarea.value = newText;

				// Reading again, to get normalized white-space
				newText = textarea.value;
				textarea.setSelectionRange(newText.length, newText.length);

				// Needed for Webkit/Blink
				textarea.blur();
				textarea.focus();
			}

			// Move to the editor
			if (typeof oQuickReply !== 'undefined')
			{
				window.location.hash = "#" + oQuickReply.opt.sJumpAnchor;
			}
			else
			{
				window.location.hash = "#" + post_box_name;
			}
		}
		else
		{
			e.target._warning.classList.remove('hide');
			setTimeout(function (warning)
			{
				e.target._warning.classList.add('hide');
				e.target.blur();
			}, 1000, e);
		}
	}

	// Initialize a QQ button, the JS way
	let quotebuttons = document.querySelectorAll('.quote_button'),
		postSelector = document.getElementById('topic_summary') ? '.postarea2' : '.postarea';

	quotebuttons.forEach((quotebutton) =>
	{
		let li = document.createElement('li'),
			link = document.createElement('a');

		li.className = 'listlevel1';
		link.className = 'linklevel1 quote_button';
		link.href = '';
		link.textContent = (typeof quickQuote !== 'undefined' && typeof quickQuote.txt !== 'undefined') ? quickQuote.txt : 'Quick Quote';

		// Find the parent postarea, poster and time of post
		let postarea = quotebutton.closest(postSelector),
			quote_msg = 'msg=' + parseInt(quotebutton.href.split('?')[1].split(';')[1].split('=')[1]),
			username = '',
			time_unix = 0;

		if (postarea)
		{
			// Topic Display
			if (postSelector === '.postarea')
			{
				username = (postarea.previousElementSibling.querySelector('.name').textContent).trim();
				time_unix = postarea.querySelector('time').getAttribute('data-timestamp');
			}
			// Topic Summary on post page
			else
			{
				username = (postarea.querySelector('.name').textContent).trim();
				time_unix = postarea.querySelector('time').getAttribute('data-timestamp');
			}
		}

		// Build our quick quote wrapper for this button
		link.startTag = '[quote' + (username ? ' author=' + username : '') + ((quote_msg && time_unix) ? ' link=' + quote_msg + ' date=' + time_unix : '') + ']';
		link.endTag = '[/quote]' + "\n";

		// Message when there's no text selected
		let warning = link.appendChild(document.createElement('span'));

		warning.className = 'warningbox hide';
		// @todo text string
		warning.textContent = 'Please select some text !';
		warning.style.position = 'absolute';
		warning.style.marginLeft = '.5em';

		link._warning = warning;
		link.addEventListener('click', executeQuickQuote, false);
		li.appendChild(link);

		// Place the QQ button at the start of the UL button stack
		quotebutton.parentNode.parentNode.insertBefore(li, quotebutton.parentNode.nextSibling);
	});
}

document.addEventListener('DOMContentLoaded', initializeQuickQuote, false);

// for attaching a translation string using quickQuote.txt
const quickQuote = {};