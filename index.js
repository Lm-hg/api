import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron'
import {WebSocketServer} from 'ws'; // Pour gérer les WebSockets
import supabase from './supabase.js';
dotenv.config();
const port = process.env.PORT || 5000;
const app = express();
app.use(cors({
  origin: 'http://127.0.0.1:5500',
  credentials: true}));
app.use(express.json()); // Pour traiter les données JSON
app.use(cookieParser())

// Route d'inscription
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Vérifier si l'utilisateur existe déjà
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);  // Toujours utiliser .eq() pour vérifier si l'email existe

  // Vérification de l'erreur de base de données
  if (userError) {
    console.error("Erreur lors de la recherche de l'utilisateur : ", userError);
    return res.status(500).json({ error: 'Erreur de la base de données' });
  }

  // Si l'utilisateur existe déjà
  if (existingUser && existingUser.length > 0) {
    return res.status(400).json({ error: 'L\'utilisateur existe déjà' });
  }

  // Hashage du mot de passe pour la sécurité
  const hashedPassword = await bcrypt.hash(password, 10);

  // Ajouter l'utilisateur dans la base de données
  const { data, error } = await supabase
    .from('users')
    .insert([{ username, email, password: hashedPassword }]);

  if (error) {
    console.error("Erreur lors de l'insertion dans la base de données : ", error);
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ message: 'Utilisateur créé avec succès', user: data });
});


app.get('/all', async(req,res)=>{
    // Trouver l'utilisateur par email
    let { data: users, error } = await supabase
    .from('users')
    .select('username');
    
})
app.get('/', async(req,res)=>{
  res.send('Konnichiwa');
  
})
// Route de connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Trouver l'utilisateur par email
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single(); // Utiliser .single() pour obtenir un seul utilisateur

  if (error || !user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  // Vérifier le mot de passe
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  // Stocker l'ID et le nom d'utilisateur dans les cookies
  res.cookie('user_id', user.id, {maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'none' });  // Le cookie est envoyé uniquement via HTTP (pas accessible via JavaScript côté client)secure: true
  res.cookie('username', user.username, {maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'none'});
  console.log(res.getHeaders());
  res.status(200).json({ message: 'Connexion réussie', user });
});

app.get('/me', (req, res) => {
  const userId = req.cookies.user_id; // Récupérer le cookie envoyé automatiquement par le navigateur

  if (!userId) {
    return res.status(401).json({ error: "Non connecté" });
  }

  res.json({ userId }); // Renvoie l'ID si l'utilisateur est connecté
});

//envoyer message
app.post('/send-message', async (req, res) => {
  const { user_id, content } = req.body;

  // Insérer le message et récupérer la donnée complète
  const { data, error } = await supabase
    .from('messages')
    .insert([{ user_id, content }])
    .select('*') // Récupérer l'objet message complet avec created_at
    .single(); 

  if (error) {
    return res.status(500).json({ error: "Erreur lors de l'enregistrement du message" });
  }

  // Récupérer le username de l'utilisateur
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('username')
    .eq('id', user_id)
    .single();

  if (userError) {
    return res.status(500).json({ error: "Erreur lors de la récupération des données utilisateur" });
  }

  // Créer un objet message avec username et created_at correct
  const message = {
    id: data.id,  // ID réel du message en BDD
    user_id,
    username: userData.username,  // Nom d'utilisateur
    content,
    created_at: data.created_at, // Date correcte
  };

  res.status(200).json({ message });
});
app.get('/get_user', async (req, res) => {
  const userId = req.cookies.user_id; // Récupérer l'ID de l'utilisateur depuis le cookie

  if (!userId) {
    return res.status(401).json({ error: "Non connecté" });
  }

  // Récupérer les informations de l'utilisateur depuis la base de données (par exemple, Supabase)
  const { data: user, error } = await supabase
    .from('users')
    .select('username, email') // Sélectionner les colonnes nécessaires
    .eq('id', userId)
    .single(); // Assurer qu'on récupère un seul utilisateur

  if (error || !user) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des informations utilisateur' });
  }

  res.json({
    userId: user.id,
    username: user.username,
    email: user.email
  });
});

// Route pour récupérer tous les messages
app.get('/get-messages', async (req, res) => {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, user_id, content, created_at')
    .order('created_at', { ascending: true }); // Optionnel : trier les messages par date

  if (error) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
// Route pour supprimer les messages
app.post('/delete-messages', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .delete() // Supprime tous les messages de la table
    .neq('id',-1);
  if (error) {
    return res.status(500).json({ error: "Erreur lors de la suppression des messages" });
  }

  res.status(200).json({ message: "Tous les messages ont été supprimés avec succès" });
});

// Planification du cron job pour appeler cette route tous les jours à 00h
cron.schedule('0 0 * * *', async () => {
  try {
    // Ici, tu appelles la route /delete-messages pour supprimer tous les messages
    const response = await fetch(`http://localhost:${port}/delete-messages`, {
      method: 'POST',
    });
    const result = await response.json();
    console.log(result.message);
  } catch (error) {
    console.error('Erreur lors de la suppression des messages:', error);
  }
});

  // Récupérer les usernames des utilisateurs associés à chaque message
  for (let message of messages) {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', message.user_id)
      .single();
    
    if (userError) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des données utilisateur' });
    }

    message.username = userData.username;
  }

  res.status(200).json({ messages });
});

// Créer un serveur WebSocket attaché au serveur HTTP
const server = app.listen(5000, () => {
  console.log(`Serveur HTTP démarré sur http://localhost:${port}`);
});

// Créer le serveur WebSocket
const wss = new WebSocketServer({ server });

// Liste pour stocker les WebSocket des clients connectés
let clients = [];

// Quand un client se connecte via WebSocket
wss.on('connection', (ws) => {
  console.log('Un client est connecté');
  clients.push(ws); // Ajouter ce client à la liste des clients

  // Quand le client envoie un message
  ws.on('message', (message) => {
    console.log('Message reçu :', message);

    // Envoyer ce message à tous les autres clients connectés
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        console.log('Envoi du message à un client:', message);
        client.send(message);
      }
    });
    
  });

  // Gérer la déconnexion du client
  ws.on('close', () => {
    console.log('Un client s\'est déconnecté');
    clients = clients.filter(client => client !== ws);
  });
});
