function base64ToHex(str) {
	let raw = atob(str);
	let result = "";

	for (let i = 0; i < raw.length; i++) {
		let hex = raw.charCodeAt(i).toString(16);
		result += (hex.length === 2 ? hex : '0' + hex);
	}
	return result.toUpperCase();
}
  
function hexToBase64(str) {
	return btoa(String.fromCharCode.apply(null,
	  str.replace(/\r|\n/g, "").replace(/([\da-fA-F]{2}) ?/g, "0x$1 ").replace(/ +$/, "").split(" "))
	);
}

// Super simple XOR encrypt function
function XORencrypt(key, plaintext) {
	let cyphertext = [];
	// Convert to hex to properly handle UTF8
	plaintext = Array.from(plaintext).map(function(c) {
		if(c.charCodeAt(0) < 128) return c.charCodeAt(0).toString(16).padStart(2, '0');
		else return encodeURIComponent(c).replace(/\%/g,'').toLowerCase();
	}).join('');
	// Convert each hex to decimal
	plaintext = plaintext.match(/.{1,2}/g).map(x => parseInt(x, 16));
	// Perform xor operation
	for (let i = 0; i < plaintext.length; i++) {
		cyphertext.push(plaintext[i] ^ key.charCodeAt(Math.floor(i % key.length)));
	}
	// Convert to hex
	cyphertext = cyphertext.map(function(x) {
		return x.toString(16).padStart(2, '0');
	});
	return cyphertext.join('');
}

// Super simple XOR decrypt function
function XORdecrypt(key, cyphertext) {
	try {
		cyphertext = cyphertext.match(/.{1,2}/g).map(x => parseInt(x, 16));
		let plaintext = [];
		for (let i = 0; i < cyphertext.length; i++) {
			plaintext.push((cyphertext[i] ^ key.charCodeAt(Math.floor(i % key.length))).toString(16).padStart(2, '0'));
		}
		return decodeURIComponent('%' + plaintext.join('').match(/.{1,2}/g).join('%'));
	}
	catch(e) {
		return false;
	}
}
