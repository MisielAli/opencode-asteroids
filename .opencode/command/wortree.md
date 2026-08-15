---
description: Crea un worktree local a partir de un nombre descrito en el argumento.
agent: build
---

El argumento recibido es: $ARGUMENTS

Deriva un nombre de worktree breve y descriptivo a partir del significado completo del argumento. Si el argumento es una frase, tiene espacios o resulta largo, resumelo a las palabras clave que identifican el cambio; no copies la frase literalmente. Usa como maximo cuatro palabras y 40 caracteres. Convierte el resultado a kebab-case: solo letras minusculas, numeros y guiones; sustituye espacios y separadores por un solo guion y elimina guiones iniciales o finales.

Ejecuta exactamente un unico comando Bash, sin cambiar de directorio, sin validar nada antes ni despues, y sin ejecutar ningun otro comando:

```bash
git worktree add ".worktrees/<nombre-del-worktree>"
```

Sustituye `<nombre-del-worktree>` por el nombre derivado. No hagas nada adicional.
