function isBitSet(number, bit) {
	return (number & (1 << bit)) !== 0;
}

function convertToRoundInteger(text) {
    var number = parseInt(text);
    if (isNaN(number)) {
        return false;
    } else {
        return Math.round(number);
    }
}
  
function removeBeforeFirstEqual(inputString) {
	const parts = inputString.split('=');
	if (parts.length > 1) {
	  return parts.slice(1).join('=');
	}
	return inputString;
}

function getFirstPartAfterDots(input) {
	const parts = input.split('.');
	if (parts.length >= 3) {
		return parts.slice(0, (parts.length - 2)).join('.');
	}
	return input;
}

function setWidthPercentage(element, percentage) {
	if (percentage >= 0 && percentage <= 100) {
		var widthValue = percentage + "%";
		$(element).css("width", widthValue);
	} else {
		console.log("Invalid percentage. It should be between 0 and 100.");
	}
}

function getDate () {
	const currentDate = new Date();

	const year = currentDate.getFullYear();
	const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
	const day = currentDate.getDate().toString().padStart(2, '0');
	
	const dateString = year + '-' + month + '-' + day;

	return dateString;
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
				sum += 2;
				break;
			case "d":
			case "e":
			case "f":
				sum += 1;
				break;
		}

	}
	return sum;
}

function getLongBase64Password(hashPass) {
	return hexToBase64(CryptoJS.SHA512(hashPass).toString() + CryptoJS.SHA224(hashPass).toString() + CryptoJS.SHA256(hashPass).toString() + CryptoJS.SHA1(hashPass).toString() + CryptoJS.SHA3(hashPass).toString() + CryptoJS.SHA384(hashPass).toString() + CryptoJS.MD5(hashPass).toString());
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
		hashRounds = 50;
	} else if (hashDifficulty == "medium") {
		hashRounds = 500;
	} else if (hashDifficulty == "high") {
		hashRounds = 2000;
	}

	if (doRoundOffset) {
		hashRounds += getRoundOffset (pass);
	}

	console.log("Hashing " + hashRounds + " rounds");
	console.time('HashTime');

	if (doHashSalting) {
		for (let i = 0; i < hashRounds; i++) {
			hashPass = returnHash(hashPass + i*1337);
		}
	} else {
		for (let i = 0; i < hashRounds; i++) {
			hashPass = returnHash(hashPass)
		}
	}


	hashPass = getLongBase64Password(hashPass);

	//console.log("Hashed key:\n" + hashPass);
	console.timeEnd('HashTime');

	return hashPass;
}

function hashBetween (startHash) {
	let hashPass = startHash;
	for (let i = 0; i < 15; i++) {
		hashPass = returnHash(hashPass + i*420)
	}
	return getLongBase64Password(hashPass);
}

//repeating hash algorithm
function returnHash(seed) {

	let key = seed;

	let pastHash = [];

	pastHash.push(CryptoJS.SHA512(seed + "RXmYwGwm4Td9nVIpmA9NFI5wcoz9HO6X").toString())
	pastHash.push(CryptoJS.SHA512(seed + "jYcXFLIgZSKOW5RD1N8GStcrQilZ7ezE").toString())
	pastHash.push(CryptoJS.SHA512(seed + "QXpJWihh5j4wb8pJiD2JLN6ziBu6oLXq").toString())

	for (let i = 0; i < seed.length; i++) {
		let currentChar = seed.charAt(i).toLowerCase();
		
		switch (currentChar) {
			case "0":
				key = CryptoJS.SHA384(key + "SF39" + pastHash[0] + pastHash[1]).toString();
				break;
			case "1":
				key = CryptoJS.SHA384(key + "DS44" + pastHash[0] + pastHash[1]).toString();
				break;
			case "2":
				key = CryptoJS.SHA384(key + "XL55" + pastHash[0] + pastHash[1]).toString();
				break;
			case "3":
				key = CryptoJS.SHA512(key + "NC01" + pastHash[0] + pastHash[1]).toString();
				break;
			case "4":
				key = CryptoJS.SHA512(key + "LU50" + pastHash[0] + pastHash[1]).toString();
				break;
			case "5":
				key = CryptoJS.SHA512(key + "GL12" + pastHash[0] + pastHash[1]).toString();
				break;
			case "6":
				key = CryptoJS.SHA256(key + "GG31" + pastHash[0] + pastHash[1]).toString();
				break;
			case "7":
				key = CryptoJS.SHA256(key + "HL11" + pastHash[0] + pastHash[1]).toString();
				break;
			case "8":
				key = CryptoJS.SHA256(key + "XF91" + pastHash[0] + pastHash[1]).toString();
				break;
			case "9":
				key = CryptoJS.SHA3(key + "BM15" + pastHash[0] + pastHash[1]).toString();
				break;
			case "f":
				key = CryptoJS.MD5(key + "TT85" + pastHash[0] + pastHash[1]).toString();
				break;
			case "e":
				key = CryptoJS.MD5(key + "RF19" + pastHash[0] + pastHash[1]).toString();
				break;
			case "d":
				key = CryptoJS.MD5(key + "MS25" + pastHash[0] + pastHash[1]).toString();
				break;
			case "c":
				key = CryptoJS.SHA1(key + "0X80" + pastHash[0] + pastHash[1]).toString();
				break;
			case "b":
				key = CryptoJS.SHA1(key + "MX55" + pastHash[0] + pastHash[1]).toString();
				break;
			case "a":
				key = CryptoJS.SHA3(key + "WT66" + pastHash[0] + pastHash[1]).toString();
				break;

		}
		pastHash.push(key);
		pastHash.shift();
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

function hexToBase64Large(hexString) {
	// Function to convert a hex string to a byte array
	function hexToBytes(hex) {
		const bytes = [];
		for (let c = 0; c < hex.length; c += 2) {
			bytes.push(parseInt(hex.substr(c, 2), 16));
		}
		return bytes;
	}

	// Convert the entire hex string to a byte array
	const byteArray = hexToBytes(hexString);

	// Convert byte array to binary string
	let binaryString = '';
	byteArray.forEach((byte) => {
		binaryString += String.fromCharCode(byte);
	});

	// Encode the binary string to base64
	let base64String =  btoa(binaryString);

    return base64String;
}


function base64ToHexLarge(base64) {
	  // Regular expression to check for valid Base64 characters
	  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

	  // Check if the input is a valid Base64 string
	  if (!base64Regex.test(base64)) {
		throw new Error("Invalid Base64 input");
	  }

	// Convert the Base64 string to a byte array
	const byteArr = new Uint8Array(atob(base64).split('').map(char => char.charCodeAt(0)));
  
	// Convert the byte array to a hexadecimal string
	const hexArray = Array.from(byteArr, byte => byte.toString(16).padStart(2, '0'));
	return hexArray.join('');
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


// Format file size in a human-readable format
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
