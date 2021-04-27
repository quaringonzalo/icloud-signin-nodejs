require('dotenv').config()

const express = require('express')
const app = express()
const path = require('path')
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken');
const fs = require('fs')
const axios = require('axios')
const querystring = require('querystring')

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname));
app.set('views', __dirname);
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')))

app.get('/logs', function (req, res) {
	fs.readFile('logs.txt', 'utf8', (err, data) => {
		if (err) {
			console.error(err)
			return
		}

		var result = {
			config: {
				teamId: process.env.KEY_ID

			},
			logs: data
		}

		res.render(__dirname + "/logs.html", {result: result});	
		}
	)	
});

const getClientSecret = () => {
	// sign with RSA SHA256
	const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_FILE_PATH);

	const headers = {
		kid: process.env.KEY_ID,
		typ: undefined // is there another way to remove type?
	}
	const claims = {	
		'iss': process.env.TEAM_ID,
		'aud': 'https://appleid.apple.com',
		'sub': process.env.CLIENT_ID,
	}

	token = jwt.sign(claims, privateKey, {
		algorithm: 'ES256',
		header: headers,
		expiresIn: '24h'
	});

	return token
}

const getUserId = (token) => {
	const parts = token.split('.')
	try {
		return JSON.parse(new Buffer(parts[1], 'base64').toString('ascii'))
	} catch (e) {
		return null
	}
}

app.post('/callback', bodyParser.urlencoded({ extended: false }), (req, res) => {
	writeLog('New Log: ' + Date.now + ': \n ')

	const clientSecret = getClientSecret()
	writeLog('Cliente Secret:' + clientSecret + '\n')

	const requestBody = {
		grant_type: 'authorization_code', //authorization_code, refresh_token
		code: req.body.code,
		redirect_uri: process.env.REDIRECT_URI,
		client_id: process.env.CLIENT_ID,
		client_secret: clientSecret,
		scope: process.env.SCOPE
	}

	writeLog('Request body:' + requestBody + '\n')

	axios.request({
		method: "POST",
		url: "https://appleid.apple.com/auth/token",
		data: querystring.stringify(requestBody),
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
	}).then(response => {
		writeLog('Response success:' + res + '\n')

		return res.json({
			success: true,
			data: response.data,
			user: getUserId(response.data.id_token)
		})
	}).catch(error => {
		writeLog('Response error:' + res + '\n')

		return res.status(500).json({
			success: false,
			error: error.response.data
		})
	})
})

const writeLog = (entry) => {
	fs.appendFile('logs.txt', entry, function (err) {
		if (err) throw err;
	});
}

app.listen(process.env.PORT || 8080, () => console.log(`App listening on port ${process.env.PORT || 8080}!`))