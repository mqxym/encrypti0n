function isBitSet(number, bit) {
	return (number & (1 << bit)) !== 0;
}
  
function removeBeforeFirstEqual(inputString) {
	const parts = inputString.split('=');
	if (parts.length > 1) {
	  return parts.slice(1).join('=');
	}
	return inputString;
}

function notificationSuccess (title, content) {
	$.Notification.notify('success','top right',title , content);
}

function notificationWarning(title, content) {
	$.Notification.notify('warning','top right',title , content);
}

function notificationError (title, content) {
	$.Notification.notify('error','top right',title , content);
}

function toggleVisibility (element, disable) {
	if(disable) {
		$("#"+element).addClass("hidden");
	} else {
		$("#"+element).removeClass("hidden");
	}
}

function setWidthPercentage(element, percentage) {
	if (percentage >= 0 && percentage <= 100) {
		var widthValue = percentage + "%";
		$(element).css("width", widthValue);
	} else {
		console.log("Invalid percentage. It should be between 0 and 100.");
	}
}

function getRoundOffset(pass) {

	const seed = CryptoJS.MD5(pass).toString();
	let sum = 0;

	for (let i = 0; i < seed.length; i++) {
		const currentChar = seed.charAt(i).toLowerCase();
		switch (currentChar) {
			case "0":
			case "1":
			case "2":
			case "3":
				sum += 4;
				break;
			case "4":
			case "5":
			case "6":
			case "7":
				sum += 3;
				break;
			case "9":
			case "a":
			case "b":
			case "c":
				sum += 5;
				break;
			case "d":
			case "e":
			case "f":
				sum += 2;
				break;
		}

	}
	return sum;
}

//calculates a password hash as a repeating hash algorithm
function hashPassword(pass, hashDifficulty, doRoundOffset, doHashSalting) {
	if (pass == "") {
		return CryptoJS.SHA512("Im looking for").toString() + CryptoJS.SHA224("friends").toString();
	}
	console.log("Started calculating password hash")
	const seed = CryptoJS.SHA512(pass).toString() + CryptoJS.SHA224(pass).toString() + CryptoJS.SHA256(pass).toString() + CryptoJS.SHA1(pass).toString() + CryptoJS.SHA3(pass).toString() + CryptoJS.SHA384(pass).toString() + CryptoJS.MD5(pass).toString();
	let hashPass = returnHash(seed);
	let hashRounds = 1;

	if (hashDifficulty == "low") {
		hashRounds = 100;
	} else if (hashDifficulty == "medium") {
		hashRounds = 1000;
	} else if (hashDifficulty == "high") {
		hashRounds = 5000;
	}

	if (doRoundOffset) {
		hashRounds += getRoundOffset (pass);
	}

	console.log("Hashing " + hashRounds + " rounds");

	//doHashRounds(hashPass, 0, hashRounds, progress, callback);

	//console.log(hashPass);

	if (doHashSalting) {
		for (let i = 0; i < hashRounds; i++) {
			hashPass = returnHash(hashPass + i*1337);
		}
	} else {
		for (let i = 0; i < hashRounds; i++) {
			hashPass = returnHash(hashPass)
		}
	}


	hashPass = CryptoJS.SHA512(hashPass).toString() + CryptoJS.SHA224(hashPass).toString() + CryptoJS.SHA256(hashPass).toString() + CryptoJS.SHA1(hashPass).toString() + CryptoJS.SHA3(hashPass).toString() + CryptoJS.SHA384(hashPass).toString() + CryptoJS.MD5(hashPass).toString();
	console.log("Hashed key:\n" + hashPass);

	return hashPass;
}

/*
function doHashRounds (seed, currentRound, hashRounds, progress, callback) {
	let hashPass = seed;

	const currentPercent = Math.round(( currentRound / hashRounds) * 100);
	setWidthPercentage(progress, currentPercent);

	if (currentRound < hashRounds) {
		currentRound++;
		//console.log(currentPercent);
		//console.log(currentRound);
		hashPass = returnHash(hashPass);
		setTimeout(() => doHashRounds(hashPass, currentRound, hashRounds, progress, callback), 10);
	} else {
		hashPass = CryptoJS.SHA512(hashPass).toString() + CryptoJS.SHA224(hashPass).toString() + CryptoJS.SHA256(hashPass).toString() + CryptoJS.SHA1(hashPass).toString() + CryptoJS.SHA3(hashPass).toString() + CryptoJS.SHA384(hashPass).toString() + CryptoJS.MD5(hashPass).toString();
		console.log("Hashed key:\n" + hashPass);
		callback(hashPass);
	}
}
*/

//repeating hash algorithm
function returnHash(seed) {

	let key = seed;

	for (let i = 0; i < seed.length; i++) {
		let currentChar = seed.charAt(i).toLowerCase();
		switch (currentChar) {
			case "0":
			case "1":
				key = CryptoJS.MD5(key).toString();
				break;
			case "2":
			case "3":
				key = CryptoJS.SHA1(key).toString();
				break;
			case "4":
			case "5":
			case "6":
				key = CryptoJS.SHA3(key).toString();
				break;
			case "7":
			case "9":
				key = CryptoJS.SHA256(key).toString();
				break;
			case "a":
			case "b":
			case "c":
				key = CryptoJS.SHA512(key).toString();
				break;
			case "d":
			case "e":
			case "f":
				key = CryptoJS.SHA384(key).toString();
				break;
		}
	}

	return key;
}

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
