const express = require('express')
const app = express()
const cors = require('cors')
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
require('dotenv').config()

const port = process.env.PORT || 5000;


const serviceAccount = require('./doctors-portal-firebase-admin-sdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pjjoy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req,res,next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const token =req.headers.authorization.split(' ')[1];

        try{
          const decodedUser=await admin.auth().verifyIdToken(token);
          req.decodedEmail =decodedUser.email;
        }
        catch{

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        console.log('database connected successfully');
        const database = client.db('doctors-appoinment');
        const appoinmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');


        app.get('/appointments',verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleString();

            const query = { email: email, date: date }

            const cursor = appoinmentsCollection.find(query)
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/appointments', async (req, res) => {
            const appoinment = req.body;
            const result = await appoinmentsCollection.insertOne(appoinment);
            res.json(result);
        });


        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        })

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result)
        })

        app.put('/users/admin',verifyToken, async (req, res) => {
            const user = req.body;
            const requester=req.decodedEmail;
            if(requester){
                const requesterAccount=await usersCollection.findOne({email:requester});
                if(requesterAccount.role ==='admin'){
                    const filter = { email: user.email }
                    const updateDoc = { $set: { role: 'admin' } }
                    const result = await usersCollection.updateOne(filter, updateDoc)
                    res.json(result);
                }
            }
            else{
                res.status(403).json({message:'you do not have access to make admin'});
            }
        })
        // Query for a movie that has the title 'Back to the Future'
        //   const query = { title: 'Back to the Future' };
        //   const movie = await movies.findOne(query);
        //   console.log(movie);
    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Doctors Portal')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})