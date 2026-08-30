# Claves de firma de QZ Tray (NO commitear)

Para que QZ Tray imprima **sin mostrar el diálogo "¿Permitir?" en cada
impresión**, los requests tienen que ir firmados con el par de claves que QZ
considera confiable. Dejá acá (en **desarrollo**) los dos archivos:

```
auth/
├── digital-certificate.txt   <- el certificado (texto PEM)
└── private-key.pem           <- la clave privada (PEM, RSA 2048)
```

Cómo obtenerlos (una vez por PC de prueba):

1. Con QZ Tray abierto: **Advanced → Site Manager** → botón **"+"** → *Create
   New* → respondé **Yes** a las tres preguntas (crear claves, instalar
   `override.crt`, copiar a `override.crt`).
2. Se crea una carpeta **"QZ Tray Demo Cert"** en el Escritorio. Copiá de ahí
   `digital-certificate.txt` y `private-key.pem` acá.
3. Reiniciá la app. Al imprimir NO debería volver a preguntar.

> El demo cert de Site Manager solo es confiable **en la PC donde se generó**.
> Para otras PC en producción hay dos caminos:
>
> - Generar un par propio (o comprar el certificado de QZ) y copiar
>   `override.crt` al `C:\Program Files\QZ Tray\` de cada equipo, o
> - repetir el paso de Site Manager en cada equipo (cada equipo tendría su
>   propio par → hay que actualizar estos archivos por equipo).

En **producción** (app instalada), estos archivos se leen de
`%APPDATA%\CantoBar POS\auth\`.