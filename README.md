# Arouca Food

Aplicativo mobile com foco em vendas para açougue e conveniência, com catálogo de produtos, carrinho, autenticação e uma área administrativa para gestão de estoque e promoções.

Este repositório concentra o projeto completo e a aplicação principal está dentro da pasta [app](app).

## Sobre o projeto

O Arouca Food foi pensado para unir duas experiências em um único app:

- Cliente: navegação de catálogo, busca, filtros, promoções e carrinho.
- Administração: cadastro e manutenção de produtos, categorias e controle de estoque.

Com isso, o fluxo operacional e o fluxo de compra ficam centralizados no mesmo ecossistema.

## Funcionalidades principais

### Área do cliente

- Catálogo com busca por nome
- Filtros por categoria
- Produtos em destaque e promoções
- Carrinho com persistência local
- Login, cadastro e perfil do usuário

### Área administrativa

- Cadastro e edição de produtos
- Gestão de categorias
- Atualização de estoque
- Configuração de produtos em promoção

## Tecnologias

- Expo
- React Native
- TypeScript
- Expo Router
- Firebase Authentication
- Cloud Firestore
- AsyncStorage

## Estrutura do repositório

- [app/app](app/app): rotas e telas
- [app/components](app/components): componentes reutilizáveis
- [app/services](app/services): regras e serviços de domínio
- [app/config/firebase.ts](app/config/firebase.ts): configuração do Firebase
- [app/constants](app/constants): constantes de autenticação, mídia e UI
- [app/styles](app/styles): estilos por tela
- [app/types](app/types): tipagens do projeto
- [app/firestore.rules](app/firestore.rules): regras de segurança do Firestore

## Como rodar localmente

1. Entre na pasta da aplicação:

   cd app

2. Instale as dependências:

   npm install

3. Inicie o projeto com Expo:

   npx expo start

## Firebase e dados

O projeto utiliza principalmente as coleções:

- produtos
- categorias
- users
- carts

Scripts de importação de produtos estão em [app/scripts](app/scripts), usando o arquivo [app/data/products-import.json](app/data/products-import.json).

## Status atual

### Implementado

- Catálogo com filtros e busca
- Carrinho com cache local e sincronização para usuário autenticado
- Autenticação com Firebase
- Painel administrativo para produtos e categorias

### Próximas evoluções

- Fluxo completo de checkout
- Persistência de pedidos
- Recuperação de senha mais robusta
- Reforço de segurança administrativa com claims server-side

## Documentação complementar

Para detalhes operacionais da aplicação Expo, consulte também [app/README.md](app/README.md).
