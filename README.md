# Arouca Food

Aplicativo mobile em React Native + Expo para catálogo, carrinho e administração de produtos do Empório Arouca.

## Visão geral

O projeto está dividido em duas frentes:

- **Área do cliente**
	- catálogo de produtos
	- produtos em promoção
	- filtro por categoria
	- busca por nome e categoria
	- carrinho local
	- autenticação e perfil

- **Área administrativa**
	- cadastro de produtos
	- edição de estoque
	- definição de promoções
	- gerenciamento de categorias

## Stack

- Expo
- React Native
- TypeScript
- Expo Router
- Firebase Authentication
- Cloud Firestore
- AsyncStorage

## Estrutura principal

- [app/app](app/app) rotas do aplicativo
- [app/components](app/components) componentes reutilizáveis
- [app/constants](app/constants) constantes e mapeamentos
- [app/services](app/services) serviços de domínio (ex.: carrinho)
- [app/styles](app/styles) estilos por tela
- [app/types](app/types) tipagens
- [app/config/firebase.ts](app/config/firebase.ts) inicialização do Firebase
- [app/constants/auth](app/constants/auth) constantes de acesso
- [app/constants/media](app/constants/media) mapeamentos de imagens
- [app/constants/ui](app/constants/ui) tema e tokens visuais
- [app/firestore.rules](app/firestore.rules) regras do Firestore

## Rotas atuais

### Cliente

- [app/app/userConfigs/index.tsx](app/app/userConfigs/index.tsx) Home / catálogo
- [app/app/userConfigs/cart.tsx](app/app/userConfigs/cart.tsx) Carrinho
- [app/app/userConfigs/profile.tsx](app/app/userConfigs/profile.tsx) Perfil / login / cadastro

### Admin

- [app/app/adminConfigs/estoque.tsx](app/app/adminConfigs/estoque.tsx) Cadastro e edição de produtos
- [app/app/adminConfigs/produtos.tsx](app/app/adminConfigs/produtos.tsx) Lista administrativa de produtos
- [app/app/adminConfigs/profile.tsx](app/app/adminConfigs/profile.tsx) Perfil admin

## Como executar

Entre na pasta do app:

```bash
cd app
```

Instale as dependências:

```bash
npm install
```

Inicie o projeto:

```bash
npx expo start
```

## Firebase

O projeto usa as seguintes coleções principais no Firestore:

- `produtos`
- `categorias`
- `users`
- `carts`

### Estrutura sugerida de `produtos`

```ts
{
	name: string;
	price: number;
	category: string;
	image: string | null;
	highlights: boolean;
	stock: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}
```

### Estrutura sugerida de `categorias`

```ts
{
	nome: string;
	createdAt?: Timestamp;
	updatedAt?: Timestamp;
}
```

### Estrutura sugerida de `users`

```ts
{
	uid: string;
	name: string;
	phone: string;
	address: string;
	addressNumber: string;
	complement?: string | null;
	cep: string;
	cpf: string;
	email: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}
```

### Estrutura sugerida de `carts`

```ts
{
	items: Array<{
		productId: string;
		name: string;
		price: number;
		qty: number;
		category?: string | null;
		image?: string | null;
		stock?: number | null;
	}>;
	updatedAt: Timestamp;
}
```

## Estado atual do projeto

### Já implementado

- catálogo com busca e filtros
- promoções destacadas
- carrinho local com sincronização no Firestore para usuários autenticados
- bloqueio de quantidade acima do estoque salvo no item
- login e cadastro com Firebase Auth
- painel admin com produtos e categorias

### Em aberto

- fluxo de checkout
- pedidos persistidos
- recuperação e troca de senha completa
- refinamentos na sincronização de carrinho entre dispositivos
- endurecimento de segurança do app

## Observações importantes

- Os acessos administrativos hoje dependem de emails definidos em [app/constants/auth/adminEmails.ts](app/constants/auth/adminEmails.ts).
- As regras do Firestore estão em [app/firestore.rules](app/firestore.rules).
- O carrinho usa AsyncStorage como cache local e sincroniza com a coleção `carts` quando o usuário está autenticado.

## Próximos passos recomendados

1. finalizar fluxo de pedido
2. persistir pedidos no Firestore
3. sincronizar carrinho por usuário autenticado
4. reforçar segurança com claims/admin server-side
