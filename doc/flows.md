# Product Flows — Molotov

Flujos actuales (live en testnet) y flujos futuros con integraciones del roadmap.

---

## FLUJOS ACTUALES

### 1. Onboarding del artista

Hay dos caminos según si el artista ya tiene wallet crypto o no.

**Camino A — artista no-crypto (Gmail)**

```
Artista abre la app
        ↓
Hace click en "Connect" → elige "Sign in with email"
        ↓
Privy abre un modal → artista pone su Gmail / Google
        ↓
Privy crea una wallet Stellar en segundo plano
        ↓
La app recibe la dirección G... y firma usando esa wallet
        ↓
Artista está adentro — nunca vio una seed phrase
```

**Camino B — artista con Freighter / xBull / Albedo**

```
Artista abre la app
        ↓
Hace click en "Connect" → elige su wallet del modal
        ↓
La extensión pide permiso → artista acepta
        ↓
La app recibe la dirección G... de la wallet
        ↓
Artista está adentro
```

> **Requisito previo**: para poder mintear, el admin tiene que haber registrado la dirección del artista en el contrato ArtistRegistry. Sin eso, el mint falla.

---

### 2. Mintear una obra

```
Artista va a /create
        ↓
Sube imagen (IPFS via Pinata) ─── imagen guardada en IPFS
        ↓
Completa: título, descripción, royalty (1–15%)
        ↓
Hace click en Mint
        ↓
La app sube los metadatos a IPFS ─── JSON con título + imagen guardado en IPFS
        ↓
La app construye la transacción → llama al contrato MolotovNFT.mint()
        ↓
Wallet firma la transacción (Privy en segundo plano, o Freighter con popup)
        ↓
La transacción se confirma en Stellar (~5 segundos)
        ↓
El indexer detecta el evento mint → escribe en Supabase
        ↓
Artista es redirigido a /my-work/[tokenId]
```

**Qué queda grabado en el contrato:**

- Dirección del artista (creador)
- Royalty (inmutable — nadie puede cambiarlo)
- Link al JSON de metadatos en IPFS

---

### 3. Listar una obra para venta

```
Artista va a /my-work/[tokenId]
        ↓
Pone el precio en XLM
        ↓
Paso 1: aprobar al contrato Marketplace para mover el NFT
        → firma transacción (approve)
        ↓
Paso 2: crear el listing
        → firma transacción (list)
        → el NFT queda en custodia del contrato Marketplace
        ↓
La obra aparece en /works con precio
```

---

### 4. Comprar una obra

```
Comprador va a /token/[tokenId]
        ↓
Ve el precio → hace click en "Buy now"
        ↓
La app construye la transacción → llama a Marketplace.buy()
        ↓
El contrato distribuye los fondos en un solo paso:
        ├── Artista recibe royalty (ej: 10 XLM de 100)
        ├── Treasury recibe fee (ej: 2.5 XLM)
        └── Vendedor recibe el resto (ej: 87.5 XLM)
        ↓
Si algún pago falla → toda la transacción se revierte
        ↓
El NFT se transfiere al comprador
        ↓
El indexer detecta el evento buy → actualiza Supabase
```

> **La clave**: el artista cobra antes de que el vendedor reciba un centavo. Es imposible que la venta se complete sin pagar el royalty.

---

### 5. Cancelar un listing

```
Artista va a /my-work/[tokenId]
        ↓
Ve que la obra está listada → hace click en "Cancel listing"
        ↓
Firma la transacción → Marketplace.cancel()
        ↓
El NFT vuelve a la wallet del artista
```

---

### 6. Admin — registrar / revocar artistas

```
Admin va a /admin (solo funciona con la wallet dueña del contrato)
        ↓
Para registrar:
        Pega la dirección G... del artista → firma → ArtistRegistry.register()
        El artista puede mintear desde ese momento
        ↓
Para revocar:
        Hace click en Revoke → confirma → firma → ArtistRegistry.revoke()
        El artista ya no puede mintear (obras existentes siguen válidas)
```

---

## FLUJOS FUTUROS

### F1. Artista cobra en su banco (alfredpay / BlindPay)

**El problema que resuelve**: el artista tiene XLM en su wallet Privy, pero quiere pesos en su CBU para pagar cosas reales.

```
Artista tiene XLM en su wallet (cobrado por royalties o ventas)
        ↓
Abre la sección "Cobrar" en la app
        ↓
Elige monto y CBU (cuenta bancaria argentina)
        ↓
La app llama a la API de alfredpay
        ↓
alfredpay recibe los XLM → los convierte a ARS usando el tipo de cambio
        ↓
Hace una transferencia bancaria al CBU del artista
        ↓
El artista recibe pesos en su banco en minutos
```

**Por qué no lo hace Privy**: Privy da la wallet on-chain. No sabe nada de bancos ni pesos. Son capas distintas.

---

### F2. Precios en USDC, Stellar invisible (Anchor Platform)

**El problema que resuelve**: un artista no quiere fijar precio en XLM porque fluctúa. Quiere poner "100 USD" y que eso sea 100 USD.

```
Artista fija precio: "100 USDC"
        ↓
Comprador ve el precio en USDC y paga en USDC
        ↓
El contrato Marketplace opera con USDC en vez de XLM nativo
        ↓
El artista cobra 10 USDC de royalty (si royalty es 10%)
        ↓
Puede retirar esos USDC a su banco via alfredpay
```

**Por qué es poderoso**: el artista cobra en dólares estables. La infraestructura Stellar es invisible para el usuario final.

---

### F3. Regalías generando yield (Blend v2)

**El problema que resuelve**: el artista cobró royalties pero no los necesita ahora. Ese XLM/USDC está parado en su wallet sin hacer nada.

```
Artista tiene 500 XLM acumulados en royalties
        ↓
Desde la app hace click en "Earn yield"
        ↓
La app deposita los fondos en un pool de Blend v2
        ↓
El dinero genera interés mientras el artista no lo necesita
        ↓
Artista puede retirar en cualquier momento (más los intereses)
```

---

### F4. Comprador desde Ethereum/Base (CCTP / Allbridge)

**El problema que resuelve**: un coleccionista tiene USDC en Ethereum y quiere comprar una obra en Molotov, pero no tiene wallet Stellar.

```
Comprador en Ethereum ve la obra en Molotov
        ↓
Hace click en "Buy with ETH wallet"
        ↓
La app usa CCTP para mover el USDC de Ethereum a Stellar en 1 paso
        ↓
El contrato Marketplace recibe el USDC y ejecuta la venta
        ↓
El artista cobra su royalty en USDC
        ↓
El comprador recibe el NFT en su wallet Stellar (creada automáticamente)
```

**Por qué importa**: abre el mercado a compradores de otras cadenas sin pedirles que aprendan Stellar.

---

### F5. Pago masivo de regalías por período (Stellar Disbursement Platform)

**El problema que resuelve**: para ediciones abiertas o colecciones grandes, el artista puede tener miles de micro-pagos acumulados. Procesarlos uno por uno es caro en fees.

```
Al final de cada período (ej: mensual)
        ↓
La app calcula todos los royalties acumulados por artista
        ↓
Usa Stellar Disbursement Platform para hacer un pago masivo
        ↓
En una sola operación, todos los artistas reciben lo que les corresponde
        ↓
Fees mínimos, una sola firma del operador
```

---

## Resumen: qué resuelve cada capa

| Integración                       | Qué problema resuelve                                         |
| --------------------------------- | ------------------------------------------------------------- |
| **Privy**                         | El artista no necesita saber qué es una wallet                |
| **Stellar Wallets Kit**           | Los coleccionistas crypto usan su wallet existente            |
| **Soroban (contratos)**           | El royalty es imposible de evadir                             |
| **alfredpay / BlindPay**          | El artista convierte crypto a pesos en su banco               |
| **Anchor Platform**               | Precios estables en USDC, sin exposición a volatilidad de XLM |
| **Blend v2**                      | Los fondos parados generan interés                            |
| **CCTP / Allbridge**              | Compradores de otras cadenas pueden comprar sin fricción      |
| **Stellar Disbursement Platform** | Pago masivo eficiente para colecciones grandes                |
