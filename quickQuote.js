// IE-inspired convenience wrappers for document.evaluate
// Used in quick quote.
// Thanks to fearphage https://gist.github.com/fearphage/222294
if ((typeof Node != 'undefined') && !document.selectNodes) {
	Node.prototype.selectNodes = function(xpath, resolver) {
		var contextNode = this.ownerDocument || this,
			result = [],
			i = 0,
			node,
			nodes = contextNode.evaluate(xpath, contextNode, resolver || null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		while (node = nodes.snapshotItem(i++)) {
			result.push(node);
		}
		return result;
	};
	Node.prototype.selectSingleNode = function(xpath, resolver) {
		return document.evaluate(xpath, this.ownerDocument || this, resolver || null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	};
}

// This particular function was based on My Opera Enhancements and is
// licensed under the BSD license.
function initializeQuickQuote() {
	'use strict';

	// early exit on PM page
	if (document.querySelector('#personal_messages')) {
		return;
	}

	/*
	 * setHiddenFlag() - transverses tree under node and set a flag telling whether element is hidden or not
	 */
	function setHiddenFlag(node) {
		if (!node) {
			return;
		}
		if (typeof node.item == 'function') {
			var k, n;
			for (k = 0; n = node[k++];) {
				setHiddenFlag(n);
			}
		} else if (isHidden(node) !== '') {
			node.setAttribute('userjsishidden', 'true');
		} else {
			if (node.removeAttribute) {
				node.removeAttribute('userjsishidden');
			}
			if (node.childNodes) {
				setHiddenFlag(node.childNodes);
			}
		}
	}
	/*
	 * isHidden() - tells if element should be considered as not visible
	 */
	function isHidden(node) {
		if (node && node.nodeType == Node.ELEMENT_NODE) {
			var compStyles = getComputedStyle(node, '');
			if (node.nodeName.toLowerCase() == 'br') return '';
			if (compStyles.display == 'none') return 'display:none';
			if (compStyles.visibility == 'hidden') return 'visibility:hidden';
			if (parseFloat(compStyles.opacity) < 0.1) return 'opacity';
			if (node.offsetHeight < 4) return 'offsetHeight';
			if (node.offsetWidth < 4) return 'offsetWidth';
			return '';
		}
		return '';
	}
	/*
	 * checkCSSProps() - compares CSS properties against a predefined array
	 */
	function checkCSSProps(node, props) {
		var start = '',
			end = '',
			k = 0,
			p;

		for (k = 0; p = props[k++];) {
			var value = trim(node.style[p.name] || '', ' "');
			if ((p.forceValue && value == p.forceValue) || (!p.forceValue && value)) {
				start += p.before.replace('@value', (p.values ? p.values[value] : null) || value);
				end += p.after;
			}
		}

		return {
			start: start,
			end: end
		};
	}
	/*
	 * treeToBBCode() - parses the tree into bbcode
	 */
	function treeToBBCode(node) {
		var k, n,
			checked, start, end,
			bb = [],
			props = [];

		if (typeof node.item == 'function') {
			for (k = 0; n = node[k++];) {
				bb.push(treeToBBCode(n));
			}
			return bb.join('');
		}

		if (node.getAttribute && node.getAttribute('userjsishidden') == 'true') {
			return;
		}

		switch (node.nodeType) {
			case Node.ELEMENT_NODE:
				var nname = node.nodeName.toLowerCase();
				var def = treeToBBCode.defaults[nname];
				if (def) {
					//generic behavior
					bb.push(def.before || '');
					bb.push(treeToBBCode(node.childNodes));
					bb.push(def.after || '');
				} else {
					//special cases
					switch (nname) {
						case 'a':
							if (node.href.indexOf('mailto:') === 0) {
								bb.push('[email=' + node.href.substring(7) + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/email]');
							} else if (node.className.indexOf("attach") >= 0) {
								bb.push('[ATTACH=' + node.href + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/ATTACH]');
							} else {
								bb.push('[url=' + node.href + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/url]');
							}
							break;
						case 'div':
							props = [{
									name: 'textAlign',
									forceValue: 'left',
									before: '[align=left]',
									after: '[/align]'
								},
								{
									name: 'textAlign',
									forceValue: 'right',
									before: '[align=right]',
									after: '[/align]'
								},
							];
							checked = checkCSSProps(node, props);

							bb.push(checked.start);
							bb.push(treeToBBCode(node.childNodes));
							bb.push(checked.end);
							break;
						case 'img':
							var smileyCode = getSmileyCode(node);
							bb.push(smileyCode ? ' ' + smileyCode + ' ' : '[img]' + node.src + '[/img]');
							break;
						case 'ul':
							props = [{
								name: 'listStyleType',
								forceValue: 'decimal',
								before: '[list type=decimal]',
								after: '[/list]'
							}, ];
							checked = checkCSSProps(node, props);

							bb.push((checked.start !== '') ? checked.start : '[list]');
							var li, lis = node.querySelectorAll('li');
							for (k = 0; li = lis[k++];) {
								bb.push('\n  [*] ' + trim(treeToBBCode(li)));
							}
							bb.push('[/list]');
							break;
						case 'span':
							//check for css properties
							props = [{
									name: 'textDecoration',
									forceValue: 'underline',
									before: '[u]',
									after: '[/u]'
								},
								{
									name: 'color',
									before: '[color=@value]',
									after: '[/color]'
								},
								{
									name: 'fontFamily',
									before: '[font=@value]',
									after: '[/font]'
								},
								{
									name: 'fontSize',
									before: '[size=@value]',
									after: '[/size]',
									values: {
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

							//check for class attribute
							props = [{
									name: 'centertext',
									before: '[align=center]',
									after: '[/align]'
								},
								{
									name: 'bbc_tt',
									before: '[tt]',
									after: '[/tt]'
								},
							];
							var p;
							for (k = 0; p = props[k++];) {
								if (node.className.indexOf(p.name) >= 0) {
									start += p.before;
									end += p.after;
								}
							}
							bb.push(start);
							bb.push(treeToBBCode(node.childNodes));
							bb.push(end);
							break;
						case 'p':
							var ns = node.nextElementSibling || node.nextSibling;
							//detect quote
							if (node.className.indexOf("cite") >= 0 &&
								ns &&
								ns.nodeName.toLowerCase() == 'blockquote' &&
								ns.className.indexOf("bbquote") >= 0) {
								//TODO: user quote - this will break when the forums get localized !
								ns.__userNameQuoted = node.textContent.replace(/.*originally\s+posted\s+by\s+/i, '').replace(/\s*\:$/, '');
							} else {
								bb.push(treeToBBCode(node.childNodes));
							}
							break;
						case 'blockquote':
							if (node.className.indexOf("bbquote") >= 0) {
								bb.push('[QUOTE' + (node.__userNameQuoted ? '=' + node.__userNameQuoted : '') + ']');
								bb.push(treeToBBCode(node.childNodes));
								bb.push('[/QUOTE]');
							} else {
								bb.push(treeToBBCode(node.childNodes));
							}
							break;
						default:
							bb.push(treeToBBCode(node.childNodes));
							break;
					}
				}
				break;
			case Node.DOCUMENT_NODE: // 9
			case Node.DOCUMENT_FRAGMENT_NODE: // 11
				bb.push(treeToBBCode(node.childNodes));
				break;
			case Node.TEXT_NODE: //3
			case Node.CDATA_SECTION_NODE: // 4
				var text = node.nodeValue;
				if (!node.selectSingleNode('ancestor::pre'))
					text = text.replace(/\n[ \t]+/g, '\n');
				bb.push(text);
				break;
		}
		return bb.join('');
	}
	treeToBBCode.defaults = {
		strong: {
			before: '[b]',
			after: '[/b]'
		},
		b: {
			before: '[b]',
			after: '[/b]'
		},
		i: {
			before: '[i]',
			after: '[/i]'
		},
		em: {
			before: '[i]',
			after: '[/i]'
		},
		s: {
			before: '[s]',
			after: '[/s]'
		},
		sup: {
			before: '[sup]',
			after: '[/sup]'
		},
		sub: {
			before: '[sub]',
			after: '[/sub]'
		},
		pre: {
			before: '[code]',
			after: '[/code]'
		},
		br: {
			before: '\n',
			after: ''
		}
	};

	/*
	 * trim() - trim string
	 */
	function trim(str, charToReplace) {
		//if char is specified, use that one else clear whitespace
		if (charToReplace) {
			return String(str).replace(new RegExp('^[' + charToReplace + ']+|[' + charToReplace + ']+$', 'g'), '');
		} else {
			return String(str).replace(/^\s+|\s+$/g, '');
		}
	}

	/*
	 * getSmileyCode() - returns smiley code
	 */
	function getSmileyCode(img) {
		if (img.alt && img.className && img.className === 'smiley') {
			// Alternative text corresponds to smiley code.
			return img.alt;
		} else {
			// Event not spawned by a forum smiley (else match smiley name below)
			return '';
		}

		/*
		    var smileyName = RegExp.$1;

		    if (buildSmileyTooltip.buildSmileyTooltipMatches[smileyName]) // Smiley is in exception list.
		      return buildSmileyTooltip.buildSmileyTooltipMatches[smileyName];
		    else // Use filename to obtain smiley code.
		      return ':'+smileyName+':';*/
	}

	function executeQuickQuote(e) {
		e.preventDefault();

		var startTag = e.target.startTag;
		var endTag = e.target.endTag;

		// isCollapsed is true for an empty selection
		var selection = (window.getSelection().isCollapsed ? null : window.getSelection().getRangeAt(0));

		if (selection) {
			var selectionAncestor = selection.commonAncestorContainer;
			var selectionContents;
			var postAncestor = selectionAncestor.selectSingleNode('ancestor-or-self::div[contains(@class,"inner")]');
			setHiddenFlag(selectionAncestor);

			if (selectionAncestor.nodeType != 3 && selectionAncestor.nodeType != 4) {
				selectionContents = selectionAncestor.cloneNode(false);
				selectionContents.appendChild(selection.cloneContents());
			} else
				selectionContents = selection.cloneContents();

			if (postAncestor) {
				// Clone tree upwards. Some BBCode requires more context
				// than just the current node, like lists.
				while (selectionAncestor != postAncestor) {
					selectionAncestor = selectionAncestor.parentNode;
					var newSelectionContents = selectionAncestor.cloneNode(false);
					newSelectionContents.appendChild(selectionContents);
					selectionContents = newSelectionContents;
				}
			}
			var selectedText = trim(treeToBBCode(selectionContents));

			//if( selectedText ){
			//var textarea = rule.getDestination();
			if (oQuickReply.bIsFull) {
				// full editor in quick reply
				$editor_data[post_box_name].insert(startTag + selectedText + endTag);
			} else {
				// just the textarea
				var textarea = document.querySelector('#postmodify').message;
				var newText = (textarea.value ? textarea.value + '\n' : '') +
					startTag + selectedText + endTag + '\n';
				textarea.value = newText;
				newText = textarea.value; //reading again, to get normalized white-space
				textarea.setSelectionRange(newText.length, newText.length);
				textarea.blur(); //needed for Webkit/Blink
				textarea.focus();
			}
		} else {
			this._warning.style.display = 'block';
			setTimeout(function(warning) {
				warning.style.display = 'none';
			}, 1000, this._warning);
		}
	}

	function findAncestor(el, cls) {
		while ((el = el.parentNode) && el.className.indexOf(cls) < 0);
		return el;
	}

	var quotebuttons = document.querySelectorAll('.quote_button');

	for (var i = 0; i < quotebuttons.length; i++) {
		var quotebutton = quotebuttons[i];
		var li = document.createElement('li');
		li.className = 'listlevel1';
		var link = document.createElement('a');
		link.className = 'linklevel1 quote_button';
		link.href = '';
		link.textContent = (typeof quickQuote !== 'undefined' && typeof quickQuote.txt !== 'undefined') ? quickQuote.txt : 'Quick Quote';

		var postarea = findAncestor(quotebutton, "postarea");

		var username = (postarea.previousElementSibling.querySelector('.name').textContent).trim();
		var quote_msg = 'msg=' + quotebutton.href.split('?')[1].split(';')[1].split('=')[1];
		var time_unix = postarea.querySelector('time').getAttribute('data-timestamp');

		link.startTag = '[quote' + (username ? ' author=' + username : '') + ((quote_msg && time_unix) ? ' link=' + quote_msg + ' date=' + time_unix : '') + ']';
		link.endTag = '[/quote]';


		//message when there's no text selected
		var warning = link.appendChild(document.createElement('span'));
		warning.textContent = 'Please select some text !';
		warning.style.border = '1px solid orange';
		warning.style.background = 'gold';
		warning.style.padding = '0.4em';
		warning.style.position = 'absolute';
		warning.style.marginLeft = '8.6em';
		warning.style.display = 'none';
		link._warning = warning;

		link.addEventListener('click', executeQuickQuote, false);

		li.appendChild(link);
		quotebutton.parentNode.parentNode.insertBefore(li, quotebutton.parentNode.nextSibling);
	}
}

document.addEventListener('DOMContentLoaded', initializeQuickQuote, false);

var quickQuote = {}; // for attaching a translation string using quickQuote.txt
