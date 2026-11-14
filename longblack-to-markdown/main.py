import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md
import time
import os
import re
from urllib.parse import urljoin
import logging
import html2text
from textwrap import dedent

class BlogScraper:
    def __init__(self, base_url, login_url):
        self.base_url = base_url
        self.login_url = login_url
        self.session = requests.Session()
        
        self.headers = {
            'authority': 'www.longblack.co',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'ko,en-US;q=0.9,en;q=0.8,ja;q=0.7',
            'dnt': '1',
            'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        }
        
        self.session.headers.update(self.headers)
        
        self.converter = html2text.HTML2Text()
        self.converter.ignore_links = False
        self.converter.body_width = 0
        self.converter.unicode_snob = True
        
        logging.basicConfig(level=logging.INFO,
                          format='%(asctime)s - %(levelname)s - %(message)s')
        self.logger = logging.getLogger(__name__)
        
    def get_xsrf_token_from_cookies(self):
        cookies = self.session.cookies.get_dict()
        xsrf_token = cookies.get('XSRF-TOKEN')
        if xsrf_token:
            from urllib.parse import unquote
            return unquote(xsrf_token)
        return None

    def login(self, username, password):
        try:
            # 1. visit main page & get initial cookie
            self.logger.info("메인 페이지 방문 중...")
            main_response = self.session.get(self.base_url, timeout=10)
            main_response.raise_for_status()
            
            # 2. visit login page, get XSRF token
            self.logger.info("로그인 페이지 방문 중...")
            login_page_url = f"{self.login_url}?return_url=%2F"
            login_response = self.session.get(login_page_url, timeout=10)
            login_response.raise_for_status()
            
            # check XSRF token 
            xsrf_token = self.get_xsrf_token_from_cookies()
            if not xsrf_token:
                self.logger.error("XSRF 토큰을 찾을 수 없습니다")
                return False
                
            self.logger.info(f"XSRF 토큰 발견: {xsrf_token[:30]}...")
            
            # parse HTML of Login page
            soup = BeautifulSoup(login_response.text, 'html.parser')
            
            # find hidden filed
            hidden_fields = {}
            for hidden_input in soup.find_all('input', type='hidden'):
                name = hidden_input.get('name')
                value = hidden_input.get('value')
                if name:
                    hidden_fields[name] = value
                    
            # 3. prepare  Login request
            login_data = {
                'email': username,
                'password': password,
                '_token': hidden_fields.get('_token', ''),
                'return_url': '/',
            }
            
            login_headers = {
                'x-xsrf-token': xsrf_token,
                'content-type': 'application/x-www-form-urlencoded',
                'referer': login_response.url,
                'origin': 'https://www.longblack.co',
                'x-requested-with': 'XMLHttpRequest'
            }
            self.session.headers.update(login_headers)
            
            # 4. send Login request
            self.logger.info("로그인 시도 중...")
            login_submit = self.session.post(
                self.login_url,
                data=login_data,
                timeout=10
            )
            
            # logging response
            self.logger.info(f"응답 상태 코드: {login_submit.status_code}")
            self.logger.info(f"응답 헤더: {dict(login_submit.headers)}")
            try:
                self.logger.info(f"응답 내용: {login_submit.text[:200]}")
            except:
                self.logger.info("응답 내용을 디코딩할 수 없습니다")
            
            if login_submit.status_code == 500:
                self.logger.error("서버 내부 오류 발생")
                return False
                
            # check is login successes
            if login_submit.status_code == 200:
                return True
            else:
                self.logger.error(f"로그인 실패 - 상태 코드: {login_submit.status_code}")
                return False
                
        except requests.Timeout:
            self.logger.error("로그인 요청 시간 초과")
            return False
        except requests.RequestException as e:
            self.logger.error(f"로그인 중 오류 발생: {str(e)}")
            return False

    def sanitize_filename(self, text):
        replacements = {
            ':': ',',
            '[': '{',
            ']': '}',
            '|': '',
            '<': '{',
            '>': '}',
            '*': '',
            '?': ',',
            '"': '"',
            '/': '',
            '\\': '',
            '#': '',
            '^': '',
        }
        
        pattern = '[' + re.escape(''.join(replacements.keys())) + ']'
        return re.sub(pattern, lambda m: replacements.get(m.group(0), m.group(0)), text)

    def get_article_urls(self, page_num):
      page_url = f"{self.base_url}/history?page={page_num}"
      try:
          self.logger.info(f"페이지 {page_num} 스캔 중...")
          response = self.session.get(page_url)
          response.raise_for_status()
          
          # debugging request status and header
          self.logger.debug(f"응답 상태: {response.status_code}")
          self.logger.debug(f"응답 헤더: {dict(response.headers)}")
          
          soup = BeautifulSoup(response.text, 'html.parser')
          
          self.logger.debug(f"페이지 HTML 구조:\n{soup.prettify()[:500]}")
          
          # get article
          article_urls = set()
          
          article_list = soup.find('div', class_=lambda x: x and ('history-list' in x.lower() or 'note-list' in x.lower()))
          if article_list:
              articles = article_list.find_all(['div', 'article', 'a'], class_=lambda x: x and ('item' in x.lower() or 'article' in x.lower() or 'note' in x.lower()))
              
              for article in articles:
                  links = [article] if article.name == 'a' else article.find_all('a')
                  for link in links:
                      href = link.get('href', '')
                      if '/note/' in href and href.split('/')[-1].isdigit():
                          full_url = urljoin(self.base_url, href)
                          article_urls.add(full_url)
                          self.logger.debug(f"발견된 URL: {full_url}")
          
          if not article_urls:
              self.logger.debug("기본 선택자로 글을 찾지 못해 대체 방법 시도")
              all_links = soup.find_all('a', href=True)
              for link in all_links:
                  href = link.get('href', '')
                  if '/note/' in href and href.split('/')[-1].isdigit():
                      full_url = urljoin(self.base_url, href)
                      article_urls.add(full_url)
                      self.logger.debug(f"대체 방법으로 발견된 URL: {full_url}")
          
          article_urls = list(article_urls)
          self.logger.info(f"페이지 {page_num}에서 {len(article_urls)}개의 글 발견")
          
          for url in article_urls:
              self.logger.debug(f"최종 URL: {url}")
          
          if not article_urls:
              self.logger.warning(f"페이지 {page_num}에서 글을 찾지 못했습니다. HTML 구조:\n{soup.prettify()[:1000]}")
          
          return article_urls
          
      except requests.RequestException as e:
          self.logger.error(f"페이지 {page_num} 처리 실패: {e}")
          return []
    
    def clean_article_content(self, content):
        for unwanted in content.find_all("a", href=re.compile(r"^#(authorinfo|friendinfo)")):
            unwanted.decompose()

        for p in content.find_all("p"):
            if re.match(r"\d{4}\.\d{2}\.\d{2}", p.get_text(strip=True)):
                p.decompose()

        for img in content.find_all("img", src=re.compile(r"new-seal\.svg")):
            img.decompose()

        return content

    def extract_content(self, soup):
        # get title
        title = None
        title_candidates = [
            soup.find('h1', class_='note-title'),
            soup.find('h1'),
            soup.find('title'),
            soup.find('meta', {'property': 'og:title'}),
            soup.find('meta', {'name': 'title'})
        ]
        
        for candidate in title_candidates:
            if candidate:
                title = candidate.get('content', candidate.text)
                if title:
                    break
        
        # get content
        article_class = "article-content"

        content = None
        content_candidates = [
            soup.find('div', class_='note-content', attrs={'data-readable': 'true'}),
            soup.find('div', class_=article_class),
            soup.find('article', class_='note-content'),
            soup.find('article'),
            soup.find('div', class_='content'),
            soup.find('div', class_='post-content'),
            soup.find('div', class_='entry-content'),
            soup.find('main'),
        ]
        
        for candidate in content_candidates:
            if candidate:
                content = candidate
                break
        
        return title, content

    def save_article_as_markdown(self, url, output_dir):
        try:
            self.logger.info(f"글 다운로드 중: {url}")
            response = self.session.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            title, content = self.extract_content(soup)
            
            if not content:
                self.logger.error(f"콘텐츠를 찾을 수 없음: {url}")
                return
                
            if not title:
                title = f"Article_{url.split('/')[-1]}"
            
            content = self.clean_article_content(content)
            
            markdown_content = md(str(content), heading_style="ATX", bullets="*", code_language="")
            markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content.strip())
            
            header = dedent(f"""

                - title: {title}
                - source: {url}

            """)

            safe_filename = self.sanitize_filename(title.strip())
            filename = f"{safe_filename[:50]}.md"
            filepath = os.path.join(output_dir, filename)
            
            metadata = dedent(f"""\
                ---
                title: {title}
                url: {url}
                date: {time.strftime('%Y-%m-%d')}
                ---

            """)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(header + markdown_content)
                # f.write(metadata + markdown_content)
                
            self.logger.info(f"저장 완료: {filename}")
            
        except Exception as e:
            self.logger.error(f"Article 처리 실패 {url}: {e}")

    def scrape_all_articles(self, start_page, end_page, output_dir):
        os.makedirs(output_dir, exist_ok=True)
        
        total_articles = 0
        failed_articles = 0
        processed_urls = set()

        page_num = start_page
        while True:
            self.logger.info(f"=== 페이지 {page_num} 처리 중 ===")
            article_urls = self.get_article_urls(page_num)
            
            if end_page is None and not article_urls:
                self.logger.info(f"페이지 {page_num}에서 글을 찾지 못했습니다. 탐색 종료")
                break
            
            if end_page is not None and page_num > end_page:
                break
            
            for url in article_urls:
                if url in processed_urls:
                    self.logger.info(f"이미 처리된 URL 건너뛰기: {url}")
                    continue
                    
                try:
                    self.save_article_as_markdown(url, output_dir)
                    total_articles += 1
                    processed_urls.add(url)
                except Exception as e:
                    self.logger.error(f"글 처리 실패 {url}: {e}")
                    failed_articles += 1
                time.sleep(1)
            
            self.logger.info(f"페이지 {page_num} 완료")
            page_num += 1
            time.sleep(2)

        
        self.logger.info(dedent(f"""
            === 스크래핑 완료 ===
            총 처리된 글: {total_articles}
            실패한 글: {failed_articles}
            중복 제외된 글: {len(processed_urls)}
            저장 위치: {output_dir}
        """))

if __name__ == "__main__":
    base_url = "https://www.longblack.co"
    login_url = "https://www.longblack.co/login"
    
    scraper = BlogScraper(base_url, login_url)
    
    username = input("이메일 또는 아이디를 입력하세요: ")
    password = input("비밀번호를 입력하세요: ")
    start_page = int(input("시작페이지를 입력하세요: "))
    end_page_input = input("끝 페이지를 입력하세요 (빈 칸이면 전체 페이지 탐색): ")
    end_page = int(end_page_input) if end_page_input.strip() else None

    if scraper.login(username, password):
        print("로그인 성공! 스크래핑을 시작합니다...")
        scraper.scrape_all_articles(start_page, end_page, "output_articles")
    else:
        print("로그인 실패. 프로그램을 종료합니다.")