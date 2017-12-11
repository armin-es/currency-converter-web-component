const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, '/')));

app.get('/*', function(req, res){
  res.sendFile(__dirname + '/public/dist/index.html');
});

app.listen(3000, () => {
	console.log('Server listening on port 3000');
});