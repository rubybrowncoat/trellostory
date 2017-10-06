/* global window, document, localStorage */

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
    snapshots: [],
    currentSnapshot: false,

    lists: {},
    current: '',

    stuff: [],
    status: 'initial',
  },
  actions: {
    setCurrent: (state, actions, current) => ({ current }),

    saveSnapshot: (state, actions) => {
      const snapshots = [...state.snapshots]

      snapshots.push({
        lists: JSON.parse(JSON.stringify(state.lists)),
      })

      return { snapshots }
    },

    viewSnapshot: (state, actions, currentSnapshot) => ({ currentSnapshot }),

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
        status: 'populating',
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
        status: 'populated',
      })
    },
    slowWalker: (state, actions, index) => {
      const item = state.stuff[index]

      let snapshot = true

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

        default:
          snapshot = false
          break
      }

      if (snapshot) {
        actions.saveSnapshot()
      }

      if (index > 0) {
        setTimeout(() => emit('slowWalker', index - 1), 5)
      } else {
        actions.changeStatus('loaded')
      }
    },
  },
  view: [
    [
      '/',
      (state, actions) => (
        <div class="app">
          {state.status !== 'loaded' ? (
            <h2 class="bottoml">Current Status: {state.status}</h2>
          ) : (
            ''
          )}
          {state.status === 'loading' ? <h3 class="bottomr">{state.current}</h3> : ''}
          {state.status === 'loaded' ? (
            <div class="bottomc">
              <div class="field has-addons">
                <div class="control is-expanded">
                  <input
                    id="snapshot"
                    class="input is-fullwidth"
                    type="number"
                    min="0"
                    max={state.snapshots.length - 1}
                    value={state.currentSnapshot || 0}
                    oninput={({ target }) => {
                      const value = target.value

                      if (value < state.snapshots.length) {
                        actions.viewSnapshot(parseInt(target.value))
                      }
                    }}
                  />
                </div>
                <div class="control">
                  <button
                    class="button is-danger"
                    onclick={() => {
                      actions.viewSnapshot(false)
                    }}>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          ) : (
            ''
          )}
          {_map(
            state.currentSnapshot === false
              ? state.lists
              : state.snapshots[state.currentSnapshot]
                ? state.snapshots[state.currentSnapshot].lists
                : {},
            list => {
              return (
                <div class="cardline" key={list.id}>
                  {_map(list.cards, card => {
                    return (
                      <div class="carda" key={card.id}>
                        <span class="icon is-success" title={card.name}>
                          <span class="fa fa-stop fa-lg has-text-warning" />
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            },
          )}
          {state.status === 'populated' ? (
            <section class="hero is-primary is-fullheight">
              <div class="hero-body">
                <div
                  class="container has-text-centered"
                  onclick={() => {
                    actions.changeStatus('loading')

                    setTimeout(() => emit('slowWalker', state.stuff.length - 1), 5)
                  }}>
                  <h1 class="title is-pointer">Load events?</h1>
                  <h2 class="subtitle">They are {state.stuff.length}, today</h2>
                </div>
              </div>
            </section>
          ) : (
            ''
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
