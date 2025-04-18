"use server"

import type { CardType, ClientCardType, GameResult, Suit, Rank } from "./types"
import { v4 as uuidv4 } from "uuid"
import { generateShuffledDeck as generateProvablyFairDeck } from "./provably-fair"

// Initialize or shuffle deck
export async function createDeck(): Promise<CardType[]> {
  const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"]
  const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
  const newDeck: CardType[] = []

  for (const suit of suits) {
    for (const rank of ranks) {
      newDeck.push({ suit, rank })
    }
  }

  // Shuffle the deck
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]]
  }

  return newDeck
}

// Create a deck using provably fair algorithm
export async function createProvablyFairDeck(serverSeed: string, clientSeed: string): Promise<CardType[]> {
  const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"]
  const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

  // Create a standard ordered deck
  const orderedDeck: CardType[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      orderedDeck.push({ suit, rank })
    }
  }

  // Get the provably fair shuffle indices
  const shuffleIndices = await generateProvablyFairDeck(serverSeed, clientSeed)

  // Create the shuffled deck
  const shuffledDeck: CardType[] = []
  for (const index of shuffleIndices) {
    shuffledDeck.push(orderedDeck[index])
  }

  return shuffledDeck
}

// Calculate score of cards
export async function calculateScore(cards: CardType[]): Promise<number> {
  let score = 0
  let aces = 0

  for (const card of cards) {
    if (card.rank === "A") {
      aces++
      score += 11
    } else if (["K", "Q", "J"].includes(card.rank)) {
      score += 10
    } else {
      // Parse the rank as a number, ensuring it's treated as base 10
      const value = parseInt(card.rank, 10)
      score += value
    }
  }

  // Adjust for aces
  while (score > 21 && aces > 0) {
    score -= 10
    aces--
  }

  return score
}

// Convert server cards to client format
export async function convertToClientCards(
  cards: CardType[],
  markNewCard = false,
  isInitialDeal = false,
  hideDealer = false,
): Promise<ClientCardType[]> {
  console.log("[convertToClientCards] Converting cards with params:", {
    markNewCard,
    isInitialDeal,
    hideDealer,
    cardCount: cards.length,
    cards: cards.map(c => ({ rank: c.rank, hidden: c.hidden }))
  })

  return cards.map((card, index) => {
    if (card.hidden) {
      console.log("[convertToClientCards] Card is hidden:", card)
      return {
        id: uuidv4(),
        hidden: true,
        isNew: markNewCard && index === cards.length - 1,
        isInitialDeal,
      }
    }

    // If hideDealer is true and it's not the first card, hide it
    const shouldHide = hideDealer && index > 0
    console.log("[convertToClientCards] Card visibility check:", { index, hideDealer, shouldHide })

    return {
      id: uuidv4(),
      suit: card.suit,
      rank: card.rank,
      hidden: shouldHide,
      isNew: markNewCard && index === cards.length - 1,
      isInitialDeal,
    }
  })
}

// Determine game result
export async function determineGameResult(playerCards: CardType[], dealerCards: CardType[]): Promise<GameResult> {
  const playerScore = await calculateScore(playerCards)
  const dealerScore = await calculateScore(dealerCards)

  if (playerScore > 21) {
    return "bust"
  }

  if (dealerScore > 21) {
    return "dealerBust"
  }

  if (playerScore === 21 && playerCards.length === 2) {
    if (dealerScore === 21 && dealerCards.length === 2) {
      return "push"
    }
    return "blackjack"
  }

  if (playerScore > dealerScore) {
    return "playerWin"
  }

  if (dealerScore > playerScore) {
    return "dealerWin"
  }

  return "push"
}

// Calculate payout based on result
export async function calculatePayout(bet: number, result: GameResult): Promise<number> {
  switch (result) {
    case "playerWin":
    case "dealerBust":
      return bet * 2 // 1:1 payout
    case "push":
      return bet // Return bet
    case "blackjack":
      return bet * 2.5 // 3:2 payout
    default:
      return 0 // Player loses
  }
}
