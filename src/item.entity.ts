import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({
  name: 'g5_shop_item',
})
export class ItemEntity {
  @PrimaryColumn({
    name: 'it_id',
  })
  id: string;

  @Column({
    name: 'it_stock_qty',
  })
  quantity: number;
}
