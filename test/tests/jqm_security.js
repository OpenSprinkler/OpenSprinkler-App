/* eslint-disable */

describe( "jQuery Mobile navigation security", function() {
	it( "does not fetch a page from an attacker-controlled hash", function() {
		var originalUrl = window.location.pathname + window.location.search + window.location.hash,
			originalAjax = $.ajax,
			ajax = sinon.stub( $, "ajax" ).returns( $.Deferred().reject().promise() );

		try {
			window.history.replaceState( null, document.title,
				window.location.pathname + window.location.search +
				"#/malicious.html?payload=%3Cimg%20src=x%20onerror=alert(1)%3E" );
			$.mobile.window.trigger( "hashchange" );

			assert.isFalse( $.mobile.ajaxEnabled );
			assert.isFalse( $.mobile.hashListeningEnabled );
			assert.isFalse( $.mobile.allowCrossDomainPages );
			assert.isFalse( ajax.called, "the hash must not initiate an XHR" );
		} finally {
			ajax.restore();
			window.history.replaceState( null, document.title, originalUrl );
		}

		assert.strictEqual( $.ajax, originalAjax, "ordinary controller AJAX remains available" );
	} );
} );
