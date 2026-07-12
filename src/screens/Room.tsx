import { useState } from 'react'
import { RoomView } from '../room/RoomView'
import type { RoomConfig } from '../room/room'
import { BED_COLORS, RUG_COLORS, SHOP_ITEMS, WALL_COLORS, getRoom, saveRoom } from '../room/room'
import { buyItem, getProgress, ownsItem } from '../progression'
import type { Roster } from '../storage'
import { colorName } from '../avatar/types'

interface Props {
  roster: Roster
  onBack: () => void
}

export function Room({ roster, onBack }: Props) {
  const [room, setRoom] = useState<RoomConfig>(() => getRoom())
  const [gems, setGems] = useState(() => getProgress().gems)
  const [message, setMessage] = useState<string | null>(null)

  const update = (next: RoomConfig) => {
    setRoom(next)
    saveRoom(next)
  }

  const toggleItem = (id: string) => {
    const item = SHOP_ITEMS.find((i) => i.id === id)!
    const owned = item.price === 0 || ownsItem(id)
    if (!owned) {
      if (buyItem(id, item.price)) {
        setGems(getProgress().gems)
        setMessage(`${item.emoji} ${item.label} rejoint ta chambre !`)
        update(item.apply(room, true))
      } else {
        setMessage(`Il te manque ${item.price - gems} 💎 — accomplis des quêtes pour en gagner !`)
      }
      return
    }
    update(item.apply(room, !item.isOn(room)))
  }

  return (
    <div className="room-screen">
      <header className="maker-header">
        <button className="btn btn-ghost" onClick={onBack}>← Studio</button>
        <h1>Ta chambre</h1>
        <span className="gems-chip">💎 {gems}</span>
      </header>

      <div className="room-body">
        <div className="card room-preview">
          <RoomView room={room} avatar={roster.self?.config} className="room-svg" />
        </div>

        <div className="card room-panel">
          {message && <p className="room-message">{message}</p>}

          <h3>Couleur des murs</h3>
          <div className="swatches">
            {WALL_COLORS.map((c) => (
              <button key={c} className={room.wall === c ? 'swatch active' : 'swatch'} aria-label={colorName(c)} title={colorName(c)} style={{ background: c }} onClick={() => update({ ...room, wall: c })} />
            ))}
          </div>

          <h3>Couleur du lit</h3>
          <div className="swatches">
            {BED_COLORS.map((c) => (
              <button key={c} className={room.bed === c ? 'swatch active' : 'swatch'} aria-label={colorName(c)} title={colorName(c)} style={{ background: c }} onClick={() => update({ ...room, bed: c })} />
            ))}
          </div>

          <h3>Tapis</h3>
          <div className="swatches">
            <button className={room.rug === null ? 'swatch active swatch-none' : 'swatch swatch-none'} onClick={() => update({ ...room, rug: null })}>
              ∅
            </button>
            {RUG_COLORS.map((c) => (
              <button key={c} className={room.rug === c ? 'swatch active' : 'swatch'} aria-label={colorName(c)} title={colorName(c)} style={{ background: c }} onClick={() => update({ ...room, rug: c })} />
            ))}
          </div>

          <h3>Boutique de la chambre</h3>
          <p className="hint">Gagne des gemmes 💎 en accomplissant des quêtes, puis décore !</p>
          <div className="shop-grid">
            {SHOP_ITEMS.map((item) => {
              const owned = item.price === 0 || ownsItem(item.id)
              const on = item.isOn(room)
              return (
                <button
                  key={item.id}
                  className={`shop-item${on ? ' on' : ''}${owned ? '' : ' locked'}`}
                  onClick={() => toggleItem(item.id)}
                >
                  <span className="shop-emoji">{item.emoji}</span>
                  <span className="shop-label">{item.label}</span>
                  <span className="shop-price">
                    {owned ? (on ? '✓ installé' : 'installer') : `${item.price} 💎`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
