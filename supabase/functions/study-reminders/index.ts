import { createReminderHandler } from './handler.mjs'

Deno.serve(createReminderHandler({ env: name => Deno.env.get(name) || '' }))
