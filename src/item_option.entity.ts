import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({
  name: 'g5_shop_item_option',
})
export class ItemOptionEntity {
  @PrimaryColumn({
    name: 'io_no',
  })
  id: string;

  @Column({
    name: 'it_id',
  })
  itemId: string;

  @Column({
    name: 'io_stock_qty',
  })
  quantity: number;
}
