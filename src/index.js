/* global window, localStorage */

import { h, app } from 'hyperapp'
import { router, Link } from '@hyperapp/router'

import logger from '@hyperapp/logger'

import Trello from 'trello'

import _map from 'lodash/map'
import _size from 'lodash/size'
import _reduce from 'lodash/reduce'

import './index.scss'

const trello = new Trello(
  '7d495f1b6bcf3bf2ec0c1e343a57a16c',
  'c635c8d1f75bc63f9abf9bb91c97da04be828f3584dd64ed4e4ba2615981dcb2',
)

const boardId = '58e3966381788412d6cd20c6'

const emit = app({
  state: {
    lists: {},
    current: '',
    stuff: [],
    status: 'nothing',
  },
  actions: {
    setCurrent: (state, actions, current) => ({ current }),

    addCard: (state, actions, { card, list }) => {
      const lists = Object.assign({}, state.lists)
      const cards = Object.assign({}, lists[list.id].cards)

      cards[card.id] = card
      lists[list.id].cards = cards

      actions.setCurrent(`+ card ${card.name || 'NO NAME'}`)

      return { lists }
    },
    removeCard: (state, actions, { card, list }) => {
      const lists = Object.assign({}, state.lists)
      const cards = Object.assign({}, lists[list.id].cards)

      delete cards[card.id]
      lists[list.id].cards = cards

      actions.setCurrent(`- card ${card.name || 'NO NAME'}`)

      return { lists }
    },
    updateCard: (state, actions, { card, list }) => {
      const lists = Object.assign({}, state.lists)
      const cards = Object.assign({}, lists[list.id].cards)

      cards[card.id] = Object.assign({}, cards[card.id], card)
      lists[list.id].cards = cards

      actions.setCurrent(`* card ${card.name || 'NO NAME'}`)

      return { lists }
    },

    addList: (state, actions, list) => {
      const lists = Object.assign({}, state.lists)

      lists[list.id] = Object.assign({}, list, { cards: {} })

      actions.setCurrent(`+ list ${list.name || 'NO NAME'}`)

      return { lists }
    },
    removeList: (state, actions, list) => {
      const lists = Object.assign({}, state.lists)

      delete lists[list.id]

      actions.setCurrent(`- list ${list.name || 'NO NAME'}`)

      return { lists }
    },
    updateList: (state, actions, list) => {
      const lists = Object.assign({}, state.lists)

      lists[list.id] = Object.assign({}, lists[list.id], list)

      actions.setCurrent(`* list ${list.name || 'NO NAME'}`)

      return { lists }
    },

    changeStatus: (state, actions, status) => ({ status }),

    populate: (state, actions, { stuff = [], status }) => ({
      stuff,
      status,
    }),
  },
  events: {
    load: async (state, actions) => {
      actions.populate({
        stuff: {},
        status: 'loading',
      })

      const localStuff = localStorage.getItem('stuff')
      const previousStuff = localStuff ? JSON.parse(localStuff) : []

      let stuff = []

      if (previousStuff.length) {
        stuff = previousStuff
      } else {
        let before = ''
        let boardActions

        do {
          boardActions = await trello.makeRequest('get', `/1/boards/${boardId}/actions`, {
            limit: 1000,
            filter: 'all',
            before,
          })

          if (boardActions.length) {
            stuff.push(...boardActions)

            before = boardActions[boardActions.length - 1].date
          }
        } while (boardActions.length)

        localStorage.setItem('stuff', JSON.stringify(stuff))
      }

      actions.populate({
        stuff,
        status: 'done',
      })
    },
    slowWalker: (state, actions, index) => {
      const item = state.stuff[index]

      switch (item.type) {
        case 'createCard':
        case 'copyCard':
          if (item.data.card && item.data.list) {
            actions.addCard({ card: item.data.card, list: item.data.list })
          }
          break
        case 'deleteCard':
          if (item.data.card && item.data.list) {
            actions.removeCard({ card: item.data.card, list: item.data.list })
          }
          break
        case 'updateCard':
          if (item.data.card && item.data.list) {
            if (item.data.card.closed) {
              actions.removeCard({ card: item.data.card, list: item.data.list })
            } else {
              actions.updateCard({ card: item.data.card, list: item.data.list })
            }
          }
          break

        case 'createList':
          if (item.data.list) {
            actions.addList(item.data.list)
          }
          break
        case 'moveListFromBoard':
          if (item.data.list) {
            actions.removeList(item.data.list)
          }
          break
        case 'updateList':
          if (item.data.list) {
            if (item.data.list.closed) {
              actions.removeList(item.data.list)
            } else {
              actions.updateList(item.data.list)
            }
          }
          break
      }

      if (index > 0) {
        setTimeout(() => emit('slowWalker', index - 1), 150)
      } else {
        actions.changeStatus('walked')
      }
    },
  },
  view: [
    [
      '/',
      (state, actions) => (
        <div class="app">
          { state.status !== 'done' ? <h2 class="bottoml">{state.status}</h2> : ''}
          <h3 class="bottomr">{state.current}</h3>
          {_map(state.lists, list => {
            return (
              <div class="cardline">
                {_map(list.cards, card => {
                  return (
                    <div class="carda">
                      <span class="icon is-success" title={card.name}>
                        <span class="fa fa-stop fa-lg has-text-warning" />
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {state.status === 'walking' ? (
            ''
          ) : (
            <button
              onclick={() => {
                actions.changeStatus('walking')

                setTimeout(() => emit('slowWalker', state.stuff.length - 1), 150)
              }}>
              {state.stuff.length}
            </button>
          )}
        </div>
      ),
    ],
    [
      '*',
      (state, actions) => (
        <Link to="/" go={actions.router.go}>
          <h1>Back to {window.location.hostname}</h1>
        </Link>
      ),
    ],
  ],
  mixins: [router(), logger()],
})
