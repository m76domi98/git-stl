#!/usr/bin/env node
import { program } from 'commander'
import { login } from './commands/login.js'
import { loadCredentials } from './config.js'

program
  .name('meshgit')
  .description('Version control for 3D mesh files')
  .version('0.0.1')

program
  .command('login')
  .description('Authenticate with GitHub')
  .action(login)

program
  .command('whoami')
  .description('Show the logged-in user')
  .action(() => {
    const creds = loadCredentials()
    if (!creds) {
      console.log('Not logged in. Run: meshgit login')
    } else {
      console.log(`Logged in as @${creds.username}`)
    }
  })

program.parse()
