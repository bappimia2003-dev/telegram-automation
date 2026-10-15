const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding new Supabase database:', supabaseUrl);

  // 1. WhatsApp Connections
  const accounts = [
    {
      id: 'acc_4929c1a7',
      phone_number: 'Gemini WhatsApp|8801830086837',
      status: 'connected',
      last_connected: new Date().toISOString(),
    },
    {
      id: 'acc_376edf0e',
      phone_number: 'bappy|8801993466370',
      status: 'connected',
      last_connected: new Date().toISOString(),
    },
    {
      id: 'acc_0ac172f0',
      phone_number: 'Meeshomart Main Whatsapp|8801410449778',
      status: 'connected',
      last_connected: new Date().toISOString(),
    },
    {
      id: 'acc_ac1e18e3',
      phone_number: '[cli:cli_fpjpvr4f5]Neuromark it|8801830086837',
      status: 'connected',
      last_connected: new Date().toISOString(),
    },
    {
      id: 'acc_552117bc',
      phone_number: '[cli:cli_5tg3k2ktl]Ushan(Airtel)|8801609251421',
      status: 'connected',
      last_connected: new Date().toISOString(),
    },
  ];

  for (const acc of accounts) {
    const { error } = await supabase.from('wa_connection').upsert(acc);
    if (error) console.error('Error seeding account', acc.id, error.message);
    else console.log('✓ Seeded account:', acc.id);
  }

  // 2. Clients
  const clients = [
    {
      id: 'cli_fpjpvr4f5',
      name: 'sabir',
      password: '5920',
      maxWhatsappNumbers: 3,
      maxCampaigns: 20,
      durationDays: 30,
      expiresAt: '2026-11-09T15:42:32.801Z',
      isActive: true,
      notes: '',
      createdAt: '2026-10-10T15:42:32.801Z',
      updatedAt: '2026-10-10T19:06:16.593Z',
    },
    {
      id: 'cli_5tg3k2ktl',
      name: 'Neuromark IT (Ushan)',
      password: 'Ushan@123',
      maxWhatsappNumbers: 1,
      maxCampaigns: 3,
      durationDays: 365,
      expiresAt: '2027-10-14T18:48:25.833Z',
      isActive: true,
      notes: '',
      createdAt: '2026-10-14T18:48:25.833Z',
      updatedAt: '2026-10-14T18:48:44.836Z',
    },
  ];

  const clientsBase64 = Buffer.from(JSON.stringify(clients)).toString('base64');
  const { error: cliErr } = await supabase.from('wa_campaigns').upsert({
    id: 'system_clients',
    name: '__SYSTEM_CLIENTS__',
    description: clientsBase64,
    is_active: false,
    updated_at: new Date().toISOString(),
  });
  if (cliErr) console.error('Error seeding system_clients:', cliErr.message);
  else console.log('✓ Seeded system_clients profiles');

  // 3. Campaigns
  const campaigns = [
    {
      id: '49f77c7f-086b-40e3-a2d1-2dd9b178937a',
      name: 'gemini pro',
      is_active: true,
      keywords: '',
      is_default: true,
      description: '[acc:acc_4929c1a7] [vars:W3sibmFtZSI6Ik1haW4gVmFyaWF0aW9uIiwiaWQiOiJ2YXJfdGVzdCIsIndlbGNvbWVNZXNzYWdlIjoi8J+UpSDgpq7gpr7gpqTgp43gprAg4Kep4Ker4KemIOCmnOCmvuCmqOCmvuCmsOCmvuCmrOCnh+CmsCDgpqzgpr7gpr7gprAgQ2hhdEdQVCwgR2VtaW5pLCBDbGF1ZGUsIENhbnZhIHNhYnByb2R1Y3Qg4Kaq4Ka+4Kaa4KeH4Kao4Ka4IPCflKQgXG5cbuKchSAxMDAlIE9mZmljaWFsIFByZW1pdW0gQWNjZXNzXG7inIUgUHJpdmF0ZSAmIFNoYXJlZCBwbGFuIGF2YWlsYWJsZSFcblxuwq7gpq/gp4fgppXgp4vgpqjgp4vgpp8g4Kao4Ka/4Kak4KeHIOCmmuCmvuCmqCwgaW5ib3gg4KaV4Kaw4KeB4KaoISJ9XQ==]',
    },
    {
      id: '60137183-4ad3-4961-8c8c-62f7a32c6ae8',
      name: 'Coursera Plus',
      is_active: true,
      keywords: 'coursera, plus, course',
      is_default: false,
      description: '[acc:acc_4929c1a7] [vars:W3siaWQiOiJ2YXJfMSIsIm5hbWUiOiJWYXJpYXRpb24gMSAoRGVmYXVsdCkiLCJpc0FjdGl2ZSI6dHJ1ZSwid2VsY29tZU1lc3NhZ2UiOiLwn46TIOCmleCnjeCmr+CmvuCmsOCmleCnh+CmsOCmviDgpqrgp43gprDgp4fgpq7gpr/gpq/gpr7gpq4g4Ka44Ka+4Kas4Ka44KeN4KaV4KeN4Kaw4Ka/4Kaq4Ka24KaoIOCmquCmvuCmqCDwn46TXG5cbvCfp5EgNzAwMCsgQ291cnNlcywgwqDwn5KlIFByb2Zlc3Npb25hbCBDZXJ0aWZpY2F0ZXMgJiDwn4yQIFVuaXZlcnNpdHkgRGVncmVlcyFcblxuwq7gpq/gp4fgppXgp4vgpqjgp4vgpp8g4Kao4Ka/4Kak4KeHIOCmmuCmvuCmqCwgaW5ib3gg4KaV4Kaw4KeB4KaoISJ9XQ==]',
    },
    {
      id: '9d166f61-f6bf-4c02-b0a6-668c601da691',
      name: 'Smart Rack 3 layer',
      is_active: true,
      keywords: 'rack, smart rack, 3 layer',
      is_default: false,
      description: '[acc:acc_0ac172f0] [vars:W3siaWQiOiJ2YXJfMSIsIm5hbWUiOiJWYXJpYXRpb24gMSAoRGVmYXVsdCkiLCJpc0FjdGl2ZSI6dHJ1ZSwid2VsY29tZU1lc3NhZ2UiOiLgpobgprjgprjgpr7gpqrgpqbgpr/gpqTgpr7gprAg4KaG4Ka34KeN4Kaa4Ka+4Kaw4KeN4Kav4Ka84KaP4KawIEZhY2Vib29rIEFkcyDgpqXgp4fgppXgp4cg4Kac4Ka+4Kao4Ka+4KawIOCmmuCnh+CmuOCnjeCmn+CmviDgpqbgpr/gpq/gpr7gpqkg4Ka54Kef4KeH4Kaf4KeHIiwiZmlsZXMiOltdfV0=]',
    },
    {
      id: '506bc13a-aab2-41e3-b6bd-d36c55faa7c8',
      name: 'Monitor Stand',
      is_active: true,
      keywords: 'stand, monitor',
      is_default: false,
      description: '[acc:acc_aa0eef93] [vars:W3siaWQiOiJ2YXJfMSIsIm5hbWUiOiJWYXJpYXRpb24gMSAoRGVmYXVsdCkiLCJpc0FjdGl2ZSI6dHJ1ZSwid2VsY29tZU1lc3NhZ2UiOiLgpobgpq7gpr7gpqbgp4fgprAgTW9uaXRvciBTdGFuZCDgpqrgp43gprDgp4vgpqHgpr7gppXgp43gpp8g4Ka44Kau4KeN4KaquCms4KeN4KaV4KeHIOCmnOCmvuCmqOCmvuCmsCDgpKzgp43gpq/gpqfgp4NOCmFzYWxhbXUgYWxhaWt1bSBzaXIuIn1d]',
    },
    {
      id: '394120ea-ad28-42c1-a86a-602b26eddbd1',
      name: 'Gmini Gmail FW',
      is_active: true,
      keywords: 'gmail, fw',
      is_default: false,
      description: '[acc:acc_4929c1a7] [vars:W3siaWQiOiJ2YXJfMSIsIm5hbWUiOiJWYXJpYXRpb24gMSAoRGVmYXVsdCkiLCJpc0FjdGl2ZSI6dHJ1ZSwid2VsY29tZU1lc3NhZ2UiOiLgpqfgpqjgp43gpq/gpqzgpr7gpqYg4KaG4Kaq4Kao4Ka+4KaV4KeHIOCnh+CmleCmvuCmqOCnhyBHbWFpbCBmdyDgpqjgpr/gp5/gp4cg4Kak4Ka+IOCmruCnh+CmuOCnh+CmnCDgpqbgpr/gpqjgp4vgpp8uIn1d]',
    },
    {
      id: '6f8f4a1d-ca7a-4475-9635-b342d9d584c5',
      name: 'Sabit Test1',
      is_active: true,
      keywords: 'test',
      is_default: false,
      description: '[cli:cli_5tg3k2ktl] [acc:acc_552117bc] [vars:W3siaWQiOiJ2YXJfMSIsIm5hbWUiOiJWYXJpYXRpb24gMSAoRGVmYXVsdCkiLCJpc0FjdGl2ZSI6dHJ1ZSwid2VsY29tZU1lc3NhZ2UiOiJoaSJ9XQ==]',
    },
  ];

  for (const c of campaigns) {
    const { error } = await supabase.from('wa_campaigns').upsert(c);
    if (error) console.error('Error seeding campaign', c.name, error.message);
    else console.log('✓ Seeded campaign:', c.name);
  }

  console.log('Seeding completed successfully!');
}

seed().catch(console.error);
