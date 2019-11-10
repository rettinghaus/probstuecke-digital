const express = require('express'),
      bodyParser = require('body-parser'),
      description = require('./src/description.js'),
      render = require('./src/render.js'),
      annotations = require('./src/annotations.js'),
      iiif = require('./src/iiif.js'),
      utils = require('./src/utils.js');

// express.js setup
const app = express();
app.set('view engine', 'pug');
app.set('views', './views');
app.use(express.static('public'));
// parse application/json
app.use(bodyParser.json());

app.get("/annotations", annotations.sendAnnotations);
app.get('/music-example', render.renderMusicExample);
app.get('/render', render.renderPage);
app.get("/download", render.downloadPDF);
app.get('/description', description.sendDescription);
app.get('/iiif/:number([0-9]{1,2})/list/:name', iiif.sendAnnotationList);

app.get('/:number([0-9]{1,2})', function(req, res) {
  // Mattheson wrote precisely 24 Prob-Stücke.
  if (req.params.number > 24) {
    res.status("404").send("Prob-Stück " + req.params.number + " does not exist.");
  } else {
    res.render('probstueck', {
      number: req.params.number
     });
  }
});

app.get('/_annotate', function(req, res) {
  res.render('annotateFacsimile');
});
app.post('/annotateFile', utils.annotateFile);
app.get('/annotatedFile', utils.annotatedFile);

app.get('/', function(req, res) {
  res.render('frontpage');
});

app.get('/howto', function(req, res) {
  res.render('howto');
});

app.get('/guidelines', function(req, res) {
  res.render('guidelines');
});

app.get('/contributions', function(req, res) {
  res.render('contributions');
});

app.listen(process.env.PORT || 3000, function() {
  console.log('Listening');
});
