// Server Command
// Running this command will run a local development
// server for the user with auto reload function

// Import libraries
const {Command, flags} = require('@oclif/command')
const {cli} = require('cli-ux')
const chalk = require('chalk')
const express = require('express')
const WebSocket = require('ws')
const fs = require('fs').promises
const fsWithoutPromises = require('fs')

// Command Class
class ServeCommand extends Command {
  // Run 
  async run() {
    // Get flags
    const {flags} = this.parse(ServeCommand)

    // Get the port
    const port = flags.port || 3000

    // Show spinner
    cli.action.start("Starting development server")

    // Create an express object
    const app = express()

    // Create a server object
    const http = require('http').Server(app)

    // For logging
    app.use((req, res, next) => {
      // Log url and method
      this.log(`${chalk.yellow(`[ ${req.method} ]`)} ${req.url}`);

      // next
      next();
    })

    // For html pages
    // we will attach a script which will listen to
    // file change event from server
    app.get([/\/$/, /.*\.html$/], async (req, res) => {
      // Get the filename
      var filename = process.cwd() + req.path;
      filename += filename.endsWith('/')? 'index.html': '';

      // Use try catch
      try {
        // Read the file
        var data = await fs.readFile(filename);
 
        // Send modified buffer to server
        res.send(`
          ${data}

          <script>
            // This script will listen to file change event
            // from server and will automatically reload the page
            
            // Setup a new connection
            var ws = new WebSocket("ws://localhost:${port}");

            // On connection
            ws.onopen = function() {
              // Connected
              console.log("Connected to Grandeur Cloud development server.");
            }

            // On message
            ws.onmessage = function(event) {
              // Received event
              console.log(event);
              if (event.data == 'file-change-event') {
                console.log("Received triger. Reloading...");
                window.location.reload(true);
              }
            }

            // On close
            ws.onclose = function() {
              // Disconnected
              console.log("Disconnected from Grandeur Cloud development server.")
            }
          </script>
        `);

      } catch (error) {
        if (error.code === "ENOENT") {
          // Log error
          this.log(`${chalk.red("[ 404 ]")} ${req.url}`);

          // File not Found
          // return 404 error
          return res.status(404).json({code: "NOT-FOUND", message: "Requested file not found on the directory."})
        }

        throw error
      }
    });

    // Serve static files from the path
    // on which the commmand was executed
    app.use(express.static(process.cwd()));

    // Use try catch
    try {
      // Check if configuration file exists
      await fs.readFile(process.cwd() + "/gc.config.json")

      // and start the http server
      await http.listen(port)

      // then start the web socket server
      const ws = new WebSocket.Server({server: http})

      // add watcher on the directory
      fsWithoutPromises.watch(process.cwd(), { recursive:true }, () => {
        // broadcast the event
        for (var client of ws.clients) {
          // send message to the client
          client.send("file-change-event");
        }

        // Log a message to console
        this.log(`Reloading clients...`);
      });

      // Then step the spinner
      cli.action.stop()

      // Log a response
      this.log(`Grandeur Cloud development server has been started on ${chalk.bold(port)} \n`)

      // Open the url in browser
      cli.open(`http://localhost:${port}`)

    } catch (error) {
      // Handle errors
      if (error.code === "ENOENT") {
        // Configuration file not found
        cli.action.stop("Failed")

        // Log error
        this.log("This directory is not associate with a project.")

        // Exit
        return
      }

      // other erros
      throw error
    }
  }
}

// Documentation
// Serve Command Description
ServeCommand.description = `run a local development server
...
This command will run a local development server in the workspace with auto reload functionality.
`
// Arguments
ServeCommand.flags = {
  port: flags.string({char: 'p', description: 'port on which server should be started'}),
}

// Export
module.exports = ServeCommand