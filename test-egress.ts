import { RoomServiceClient } from 'livekit-server-sdk';
import * as fs from 'fs';

async function main() {
  const roomService = new RoomServiceClient(
    'http://localhost:7880', // Replace with LIVEKIT_URL
    'devkey', // LIVEKIT_API_KEY
    'secret' // LIVEKIT_API_SECRET
  );
  
  // We don't have the .env loaded, so let's load it
  require('dotenv').config();
  
  const rs = new RoomServiceClient(
    (process.env.LIVEKIT_URL || '').replace(/^ws/, 'http'),
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );

  const rooms = await rs.listRooms();
  console.log('Active rooms:', rooms.map(r => r.name));
  
  for (const room of rooms) {
    const participants = await rs.listParticipants(room.name);
    console.log(`Room ${room.name} participants:`);
    for (const p of participants) {
      console.log(` - ${p.identity} (role: ${p.metadata})`);
      for (const t of p.tracks) {
         console.log(`    track: ${t.sid} type: ${t.type} source: ${t.source}`);
      }
    }
  }

  const { EgressClient, StreamOutput, StreamProtocol } = require('livekit-server-sdk');
  const ec = new EgressClient(
    (process.env.LIVEKIT_URL || '').replace(/^ws/, 'http'),
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );

  try {
    const output = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls: ['rtmp://a.rtmp.youtube.com/live2/fake-key'],
    });

    console.log('Output object:', output);
    const info = await ec.startTrackCompositeEgress('52d38cc5-c096-4ae4-b7ee-88618cea9e7b', { stream: output }, { audioTrackId: undefined, videoTrackId: undefined });
    console.log(info);
  } catch (err) {
    console.error('Error:', err);
  }
}

main().catch(console.error);
