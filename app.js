const prefix = 'nft!';
const fardserver = 'freedom.play.totalfreedom.me';
const chatDelay = 1500;
const nftGenDelay = 1000 * 60 * 60 * 2; // every 2 hours
const mapartRate = 4;

let nftCounter = 0;

const mc = require('minecraft-protocol'),
      { createCanvas, loadImage, registerFont } = require('canvas'),
      fs = require('fs'),
      http = require('http');

let fetch;

import('node-fetch').then(f => fetch = f.default);

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Please provide a Microsoft email to login with!');
  return;
}

let mcData;

let chatRegex = new RegExp("^(.*) » +" + prefix + "(\\S+)(?:\\s+(.*))?$", "i");

let client = mc.createClient({
  host: fardserver,
  username: args[0],
  auth: 'microsoft',
  version: '1.17.1'
});

let mailingList = [];

client.on('position', function(packet) {
  client.write('teleport_confirm', { teleportId: packet.teleportId });
});

client.on('connect', async function() {
  setInterval(() => {
    if (chatsToSend.length > 0) {
      let msgParts = chatsToSend.shift();
      client.write('chat', {
        message: msgParts[0].slice(0, 256)
      });
      msgParts[1]();
    }
  }, chatDelay);
  
  await sleep(chatDelay);
  
  mcData = require('minecraft-data')(client.version || '1.17.1');
  await populateImages();
  
  setInterval(() => {
    generateRandomNFT();
  }, nftGenDelay);
  generateRandomNFT();
});

client.on('end', function() {
  console.log('Connection lost');
  process.exit();
});

client.on('error', function(err) {
  console.log('Error occured');
  console.log(err);
  process.exit(1);
});

const sleep=t=>new Promise(a=>setTimeout(a,t)),
      chatsToSend = [],
      sendChat=async function(m){
        await new Promise(r => chatsToSend.push([m, r]));
      };

//todo: chat cooldown: store last chat msg sent time and use it? or maybe...COMMAND cooldown :D

function funnyParser(msgPieces, nesting) {
  if (!nesting) {
    nesting = 0;
  } else if (nesting > 10) {
    return ''; // lost...
  }
  
  let res = '';
  
  if (msgPieces.hasOwnProperty('text')) res += msgPieces.text;
  if (msgPieces.hasOwnProperty('extra')) {
    let morePieces = msgPieces.extra;
    for (let extraPiece of morePieces) {
      if (typeof extraPiece == 'string') {
        res += extraPiece;
      } else {
        res += funnyParser(extraPiece, nesting + 1);
      }
    }
  }

  return res;
}

client.on('chat', async function(packet) {
  let jsonMsg = JSON.parse(packet.message);
  
  let msg = funnyParser(jsonMsg);
  
  //console.log(msg);
  
  let senderIsReal = packet.sender != '00000000-0000-0000-0000-000000000000';
  
  if (!senderIsReal) return;
  
  chatRegex.lastIndex = 0;
  
  let msgMatches = chatRegex.exec(msg);
  
  if (!msgMatches) return;
  
  if (msgMatches.length < 3) return;
  
  let msgArgs = msgMatches.slice(2).join(' ').trim().split(' ');
  
  switch (msgArgs[0].toLowerCase()) {
    case 'help':
      await sendChat(`Commands: notifs [on|off] ; gen ; build <url> [width] [height] [dither]`);
      break;
    case 'gen':
      await sendChat('Generating a random NFT upon user request...');
      await generateRandomNFT();
      break;
    case 'notifs':
      let addingElseRemoving;
      
      switch (msgArgs.length == 1 ? '' : msgArgs[1].toLowerCase()) {
        case 'on':
        case 'yes':
        case 'y':
        case 'true':
        case '1':
          addingElseRemoving = true;
          break;
        case 'off':
        case 'no':
        case 'n':
        case 'false':
        case '0':
          addingElseRemoving = false;
          break;
        default:
          addingElseRemoving = !mailingList.includes(packet.sender);
      }
      
      const index = mailingList.indexOf(packet.sender);
      
      if (addingElseRemoving) {
        if (index > -1) {
          await sendChat('/w ' + packet.sender + ' You are already on the mailing list!');
        } else {
          mailingList.push(packet.sender);
          await sendChat('/w ' + packet.sender + ' Added to the mailing list.');
        }
      } else {
        if (index > -1) {
          mailingList.splice(index, 1);
          await sendChat('/w ' + packet.sender + ' Removed from the mailing list.');
        } else {
          await sendChat('/w ' + packet.sender + ' You are not on the mailing list!');
        }
      }
      
      
      break;
    case 'build':
      await sendChat('`mapart ' + msgArgs.slice(1).join(' '));
      break;
    default:
      await sendChat('That command was not found!');
      return;
  }
});

// https://stackoverflow.com/questions/14484787/wrap-text-in-javascript

const wrap = (s, w) => s.replace(new RegExp(`(?![^\\n]{1,${w}}$)([^\\n]{1,${w}})\\s`, 'g'), '$1\n');

registerFont(__dirname + '/Graph-35-pix.ttf', { family: 'NFT Font' });
const c = createCanvas(128, 128),
      ctx = c.getContext('2d');

const faces = [],
      facewears = [],
      shirts = [],
      quotes = [
        'ah fuck',
        'bollocks',
        'VORE',
        'whar?',
        'HOLY FUCKING SHIT',
        'when video contribute to plex...'
      ];

async function populateImages() {
  let files = fs.readdirSync(__dirname + '/shirts');
  for (let file of files) shirts.push(await loadImage(__dirname + '/shirts/' + file));
  
  files = fs.readdirSync(__dirname + '/faces');
  for (let file of files) faces.push(await loadImage(__dirname + '/faces/' + file));
  
  files = fs.readdirSync(__dirname + '/facewears');
  for (let file of files) facewears.push(await loadImage(__dirname + '/facewears/' + file));
}

function randomHexColor() {
  return '#000000'.replace(/0/g,function(){
    return (~~(Math.random()*16)).toString(16);
  });
}

function randNum(max) {
  return Math.floor(Math.random() * max);
}

async function generateRandomNFT() {
  return await generateNFT({
    colors: [ randomHexColor(), randomHexColor() ],
    x: Math.floor(Math.random() * c.width),
    y: Math.floor(Math.random() * c.height)
  }, randNum(faces.length), randNum(facewears.length), randNum(shirts.length), randNum(quotes.length), 'nft number ' + Math.floor(Math.random() * 100000));
}

// TODO: use that wordwrap function from the other bot

async function generateNFT(bgparams, face, facewear, shirt, quote, name) {
  ctx.clearRect(0, 0, c.width, c.height);
  
  const grd = ctx.createRadialGradient(bgparams.x, bgparams.y, 5, 90, 60, 100);
  for (let i in bgparams.colors) grd.addColorStop(i / bgparams.colors.length, bgparams.colors[i]);

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, c.width, c.height);
  
  ctx.drawImage(shirts[shirt], 0, 0, 128, 128);
  ctx.drawImage(faces[face], 0, 0, 128, 128);
  ctx.drawImage(facewears[facewear], 0, 0, 128, 128);
  
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = 'white';
  
  ctx.font = '6px "NFT Font"';
  ctx.fillText(wrap(quotes[quote], 10), 64, 16);
  
  ctx.globalCompositeOperation = 'source-over';
  
  let url = await uploadImage(c.toBuffer('image/png'), name + '.png', 'image/png');
  
  //console.log(url);
  
  nftCounter = (nftCounter + 1) % mapartRate;
  if (nftCounter == 0) {
    await sendChat('`mapart ' + url + ' 1 1 false');
  } else {
    await sendChat('New NFT just dropped: ' + url);
  }
  
  for (let uuid of mailingList) await sendChat('/mail send ' + uuid + ' NFT "' + name + '" done! ' + url);
}

async function uploadImage(buffer, name, type) {
  /*
  return await (await fetch('https://linx.zapashcanon.fr/upload/' + name, {
    method: 'PUT',
    headers: {
      'Linx-Expiry': '60',
      'Linx-Randomize': 'yes'
    },
    body: buffer//new File(buffer, name, { type: type })
  })).text();
  */
  return (await (await fetch('https://transfer.sh/' + name, {
    method: 'PUT',
    headers: {
      //'Max-Downloads': '1',
      'Max-Days': '7'
    },
    body: buffer
  })).text()).replace('https://transfer.sh/', 'https://transfer.sh/get/');
}