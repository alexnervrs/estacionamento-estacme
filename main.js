import { App } from "./src/servicos/App.js";

const app = new App();
app.iniciar().catch((erro) => {
  console.error("\nErro inesperado no sistema:", erro.message);
  process.exit(1);
});
