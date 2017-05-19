const Hapi = require('hapi');
const mongojs = require('mongojs');
const redis = require('redis');
const Wreck = require('wreck');
const uuidV4 = require('uuid/v4');
const faker = require('faker');
var admin = require('firebase-admin');

var serviceAccount = require('./project-aviron.json');

var defaultApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://aviron-dev.firebaseio.com"
});

console.log(defaultApp.name);  // "[DEFAULT]"

// Retrieve services via the defaultApp variable...
//var defaultAuth = defaultApp.auth();
//var defaultDatabase = defaultApp.database();

// ... or use the equivalent shorthand notation
var defaultAuth = admin.auth();
var defaultDatabase = admin.database();


var verifyToken = function(token, callback) {

     defaultAuth.verifyIdToken(token)
          .then(function(decodedToken) {

              callback(null, decodedToken);
           
          }).catch(function(error) {
            
              callback(error); 
          });
}

// Loads environment variables
// Used only in development
require('dotenv').config({silent: true});

const redisClient = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST, {no_ready_check: true});

redisClient.auth(process.env.REDIS_PASSWORD, function (err) {
    if (err) throw err;
});

redisClient.on('connect', function() {
    console.log('Connected to Redis');
});

redisClient.on("error", function(err) {
  console.log("Error: " + err)
});

redisClient.set("string key", "string value", redis.print);
redisClient.hset("hash key", "hash value 1", "some value", redis.print);
redisClient.hset("hash key", "hash value 2", "some other value", redis.print);
redisClient.hkeys("hash key", function(err, replies) {
  console.log(replies.length + " replies:");
  replies.forEach(function(reply, i) {
    console.log("  " + i + ":" + reply);
  });

  redisClient.quit();
});
  



var url = process.env.MONGO_HOST + '/api';
console.log("*** mongodb url: " + url)

const server = new Hapi.Server();
server.connection({ port: process.env.PORT || 3000 });

// Connect with the database
server.app.db = mongojs(process.env.MONGO_HOST);
// server.app.db = mongojs('mongodb://truonglvx:aviron@gcp-us-east1-cpu.4.dblayer.com:15699,gcp-us-east1-cpu.2.dblayer.com:15699/api?ssl=true');

// Add the routes
server.register(require('./routes'), (err) => {

  if (err) {
    console.error('Failed to load plugin:', err);
  }

  // Start the server
  server.start((err) => {
    if (err) {
      throw err;
    }
    console.log('Server running at:', server.info.uri);
  });
});

const users = [
  {
    userid: 1,
    username: 'aaa',
    level: 2
  },
  {
    userid: 2,
    username: 'bbb',
    level: 12
  }
]

server.route({
  method: 'GET',
  path: '/welcome',
  handler: (request, reply) => {
      const user = faker.internet.userName(); 
      const email = faker.internet.email();
      const password = "aviron";
      const displayName = faker.address.state();
     

        Wreck.post('http://avironactive.com/api/signup', { payload: { username: user, password: password,  email: email, screenname: displayName} }, (err, res, payload) => {
          /* do stuff */
          if(err) {
             reply("ahuhu");
          }
          console.log('ahihi');
          reply(payload);
        });
      
  }
});

server.route({
  method: 'POST',
  path: '/login',
  handler: (request, reply) => {
       const username = request.payload.username;
       const password = request.payload.password;
     for(var i=0; i<users.length; i++) {
    
         if(users[i].username === username) {

              var uid = uuidV4();

              var additionalClaims = {
                userid: users[i].userid,
                username: users[i].username,
                level: users[i].level,
              };

              defaultAuth.createCustomToken(uid, additionalClaims)
                .then(function(customToken) {
                  // Send token back to client
                  console.log(customToken);
                  reply.redirect('/redirectedpage');
                })
                .catch(function(error) {
                  console.log("Error creating custom token:", error);
                  reply({err: 400})
                });
         }
      }

  }
});


server.route({
    method: 'GET',
    path: '/customtoken',
    handler: (request, reply) => {

      
      var uid = uuidV4();

      var additionalClaims = {
        username: faker.internet.userName(),
        avatar: faker.image.imageUrl(),
        level: faker.address.zipCode()
      };

      admin.auth().createCustomToken(uid, additionalClaims)
        .then(function(customToken) {
          // Send token back to client
          console.log(customToken);
          reply(customToken)
        })
        .catch(function(error) {
          console.log("Error creating custom token:", error);
          reply(error)
        });
    }
  });

  server.route({
    method: 'POST',
    path: '/createroom',
    handler: (request, reply) => {

      var token = request.payload.token;
      verifyToken(token, (error, decodedToken) => {
        if(error) {

           reply({errorinfo: error.errorInfo, msg: error.message}).code(401);

        } else {
              var userid = decodedToken.uid;
              var rootRef = defaultDatabase.ref();
              var roomRef = defaultDatabase.ref("aviron/games/rooms");

              const room = {roomid: uuidV4(), roomName: faker.address.country(), owner: userid};
              roomRef.push(room);
              return reply(room).code(200);
        }

      });
    }

  });

server.route({
  method: "POST",
  path: '/createuser',
  handler: (request, reply) => {

    var username = request.payload.username;
    var password = request.payload.password;
    var email = request.payload.email;

    defaultAuth.createUser({
        uid: "some-uid",
        username: username,
        password: password,
        email: email,
      })
        .then(function(userRecord) {
          // See the UserRecord reference doc for the contents of userRecord.
          console.log(userRecord.uid);
          reply("Successfully created new user:", userRecord.uid);
        })
        .catch(function(error) {
          console.log("Error creating new user:", error);
          reply("Error creating new user:", error);
        });
  }
});


server.route({
  method: "POST",
  path: '/getuser',
  handler: (request, reply) => {

    //var username = request.payload.username;
    //var password = request.payload.password;
    //var email = request.payload.email;
    var userid = request.payload.userid;

    defaultAuth.getUser(userid)
    .then(function(userRecord) {
      // See the UserRecord reference doc for the contents of userRecord.
      console.log("Successfully fetched user data:", userRecord.toJSON());
      reply(userRecord.toJSON());
    })
    .catch(function(error) {
      console.log("Error fetching user data:", error);
      reply("Error fetching user data:", error);
    });

  }
});


 server.route({
    method: 'POST',
    path: '/verifytoken',
    handler: (request, reply) => {

    var token = request.payload.token;
    console.log('firebase token: ' + token);
    verifyToken(token, (error, decodedToken) => {
        if(error) {
           reply({errorinfo: error.errorInfo}).code(401);
        } else {
           var uid = decodedToken.uid;
           reply(uid).code(200);
        }
    })
    }
  });
