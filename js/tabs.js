export const tabMagic = {
  _map: {},

  init() {
    const lists = document.getElementsByTagName('ul');
    for(let i=0; i<lists.length; i++) {
      if(lists[i].className.indexOf('tablist') >= 0) {
        const tabs = lists[i].getElementsByTagName('li');
        for(let j=0; j<tabs.length; j++) {
          tabMagic._map[tabs[j].getAttribute('rel')] = lists[i].id;
          tabs[j].onclick = () => {
            tabMagic.sw(tabs[j].getAttribute('rel'));
            return false;
          };
        }
        tabMagic.sw(tabs[0].getAttribute('rel'));
      }
    }
  },

  sw(tr) {
    const tabLists = document.getElementsByTagName('ul');
    for(let li=0; li<tabLists.length; li++) {
      if(tabLists[li].className.indexOf('tablist') >= 0 && 
         tabLists[li].id == tabMagic._map[tr]) {
        const items = tabLists[li].getElementsByTagName('li');
        for(let lj=0; lj<items.length; lj++) {
          if(items[lj].getAttribute('rel') == tr) {
            items[lj].className = 'tab_hi';
            document.getElementById(items[lj].getAttribute('rel')).style.display = 'block';
          } else {
            items[lj].className = 'tab';
            document.getElementById(items[lj].getAttribute('rel')).style.display = 'none';
          }
        }
      }
    }
  }
};
