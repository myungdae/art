$(function() {
    const menus = ['Job_Vacancies', 'Job_Seekers', 'Online_Tutors']
    const more_menus = []
    const ul_document = document.querySelector(".navbar-nav.justify-content-center");
    
    if (ul_document) {
       
        createMenus();
        createMoreMenu();
    }

    function createMenus() {
        menus.forEach(menu => {
            // 메뉴 이름을 영어로 변환 (클래스에 적용하기 위해)
            // const menuClass = translateToEnglish(menu);

            // li 요소 생성
            const li = document.createElement("li");
            li.className = "nav-item text-nowrap";

            // a 요소 생성
            const a = document.createElement("a");
            a.href = "#";
            a.className = "nav-link text-dark";
            a.setAttribute("aria-haspopup", "true");
            a.setAttribute("aria-expanded", "false");
            a.style.lineHeight = "inherit";

            // h5 요소 추가
            const h5 = document.createElement("h5");
            h5.className = "my-0 d-inline";
            h5.textContent = menu;

            // 요소 연결
            a.appendChild(h5);
            li.appendChild(a);
            ul_document.appendChild(li);

            // sub-menu 처리
            // .dropdown-menu 생성
            getData(menu).then((data) => {
                if(data.length > 1) {
                    a.setAttribute("data-toggle", "dropdown");
                    a.classList.add("dropdown-toggle");
                    const dropdownMenu = document.createElement("div");
                    dropdownMenu.className = `dropdown-menu`;
                    dropdownMenu.setAttribute("aria-labelledby", `navbarDropdown-`);
                    dropdownMenu.style.left = "inherit";
                    dropdownMenu.style.maxHeight = "350px";
                    dropdownMenu.style.overflow = "scroll";
                    li.appendChild(dropdownMenu);

                    const subMenuItem = document.createElement("a");
                        subMenuItem.className = "dropdown-item";
                        subMenuItem.href = `/facet/${menu}`;
                        subMenuItem.textContent = "All";  // 서브 메뉴 항목 이름
                        dropdownMenu.appendChild(subMenuItem);

                    data.map((d) => d._id.replace(_resource, '')).sort((a, b) => a.localeCompare(b)).forEach(subMenu => {
                        const subMenuItem = document.createElement("a");
                        subMenuItem.className = "dropdown-item";
                        subMenuItem.href = `/facet/${menu}/${subMenu}`;
                        subMenuItem.textContent = subMenu;  // 서브 메뉴 항목 이름
                        dropdownMenu.appendChild(subMenuItem);
                    });
                } else {
                    a.href = `/facet/${menu}`;
                }
            });
        });
    }

    function createMoreMenu() {
         // li 요소 생성
         const li = document.createElement("li");
         li.className = "nav-item text-nowrap";
 
         // a 요소 생성
         const a = document.createElement("a");
         a.href = "#";
         a.className = "nav-link dropdown-toggle text-dark";
         a.setAttribute("id", "navbarDropdownAchieve");
         a.setAttribute("data-toggle", "dropdown");
         a.setAttribute("aria-haspopup", "true");
         a.setAttribute("aria-expanded", "false");
         a.style.lineHeight = "inherit";
 
         // h5 요소 추가
         const h5 = document.createElement("h5");
         h5.className = "my-0 d-inline font-weight-bold";
         h5.textContent = "+ more";
 
         // .dropdown-menu 생성
         const dropdownMenu = document.createElement("div");
         dropdownMenu.className = "dropdown-menu";
         dropdownMenu.setAttribute("aria-labelledby", "navbarDropdownAchieve");
         dropdownMenu.style.left = "inherit";
         dropdownMenu.style.maxHeight = "350px";
         dropdownMenu.style.overflow = "scroll";
 
         // more_menus 배열을 순회하면서 a 요소 추가
         more_menus.forEach(menu => {
             const menuItem = document.createElement("a");
             menuItem.className = "dropdown-item";
             menuItem.href = `/facet/${menu}`;
             menuItem.textContent = menu;
             dropdownMenu.appendChild(menuItem);
         });
 
         // 요소 연결
         a.appendChild(h5);
         li.appendChild(a);
         li.appendChild(dropdownMenu);
         ul_document.appendChild(li);
    }

    function getData(menu) {
        return fetch(`/data/subMenu/${menu}`)
            .then(response => {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let chunks = '';
    
                function readStream() {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            const data = JSON.parse(chunks);
                            return data;  // 데이터를 반환
                        }
    
                        chunks += decoder.decode(value, { stream: true });
                        return readStream();
                    });
                }
    
                return readStream();
            })
            .catch(error => {
                console.error('API 요청 실패:', error);
                return [];  // 요청 실패 시 빈 배열 반환
            });
    }
    

});