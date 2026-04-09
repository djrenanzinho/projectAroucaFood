# Arouca Food App

Aplicativo Expo do projeto Arouca Food.

## Executar

```bash
npm install
npx expo start
```

## Principais pontos

- catálogo de produtos
- filtros inteligentes por busca, categoria, preço e disponibilidade
- carrinho com cache local em AsyncStorage e sincronização no Firebase para usuário autenticado
- área administrativa para produtos e categorias
- autenticação com Firebase

## Categorias padrão

- Churrasco
- Suínos e Frangos
- Bebidas
- Cervejas
- Espetos
- Itens para churrasco
- Hamburguer
- Acompanhamentos
- Kits

## JSON de importação

Arquivo: [data/products-import.json](data/products-import.json)

Campos esperados por item:

- `name` (string)
- `price` (number)
- `category` (string)
- `image` (string)
- `highlights` (boolean)
- `stock` (number)
- `expiryDate` (string no formato `AAAA-MM-DD` ou `null`)

## Importar produtos para o Firebase

Baixe uma chave de serviço JSON do projeto no Google Cloud / Firebase e salve como:

- [serviceAccountKey.json](serviceAccountKey.json)

ou defina a variável `GOOGLE_APPLICATION_CREDENTIALS` apontando para esse arquivo.

No terminal, dentro da pasta `app`, rode:

```powershell
npm run import:products
```

O importador lê [data/products-import.json](data/products-import.json) e:

- cria categorias que ainda não existem
- atualiza produtos existentes (mesmo nome)
- cria produtos novos

### Fluxo recomendado

1. abrir Firebase Console
2. gerar a service account do projeto
3. salvar o arquivo como `serviceAccountKey.json` dentro de [app](.)
4. rodar `npm run import:products`

### Comando alternativo antigo

O importador antigo baseado em login continua disponível em:

```powershell
npm run import:products:auth
```

## Arquivos importantes

- [app/index.tsx](app/index.tsx)
- [app/userConfigs/index.tsx](app/userConfigs/index.tsx)
- [app/userConfigs/cart.tsx](app/userConfigs/cart.tsx)
- [app/userConfigs/profile.tsx](app/userConfigs/profile.tsx)
- [app/adminConfigs/estoque.tsx](app/adminConfigs/estoque.tsx)
- [config/firebase.ts](config/firebase.ts)
- [firestore.rules](firestore.rules)

## Documentação completa

Consulte o README principal em [../README.md](../README.md).
